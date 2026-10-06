-- =============================================================
-- Editar e apagar as próprias mensagens (estilo WhatsApp).
-- Regras no banco: só as próprias, editar só texto até 15 min, apagar até 48 h,
-- nunca a aprovação nem o pedido de ajuste. Ninguém altera mensagem direto:
-- só por editar_mensagem e apagar_mensagem.
-- =============================================================

alter table public.mensagens
  add column editada_em timestamptz,
  add column apagada_em timestamptz;

-- A Bea lia e escrevia tudo ("for all"): trocamos por ler tudo e escrever só como Bea.
-- Sem policy de UPDATE/DELETE para ninguém; a exclusão do conteúdo apaga em cascata.
drop policy "admin gerencia mensagens" on public.mensagens;

create policy "admin lê mensagens" on public.mensagens
  for select to authenticated
  using (public.is_admin());

create policy "admin envia mensagem como bea" on public.mensagens
  for insert to authenticated
  with check (
    public.is_admin()
    and autor = 'bea'
    and not pedido_ajuste
    and public.mensagem_valida(conteudo_id, tipo, texto, arquivo_url)
  );

-- A mensagem é de quem está chamando e pode ser mexida? (devolve a linha travada)
create or replace function public.minha_mensagem_alteravel(p_mensagem_id uuid)
returns public.mensagens
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.mensagens;
begin
  select * into m from public.mensagens where id = p_mensagem_id for update;

  if m.id is null
     or not (
       (m.autor = 'bea' and public.is_admin())
       or (m.autor = 'cliente' and not public.is_admin() and public.cliente_ve_conteudo(m.conteudo_id))
     ) then
    raise exception 'Você só pode mexer nas suas próprias mensagens.' using errcode = 'P0001';
  end if;
  if m.tipo = 'aprovacao' or m.pedido_ajuste then
    raise exception 'A aprovação e o pedido de ajuste ficam como registro e não podem ser alterados.' using errcode = 'P0001';
  end if;
  if m.apagada_em is not null then
    raise exception 'Esta mensagem já foi apagada.' using errcode = 'P0001';
  end if;
  return m;
end;
$$;

create or replace function public.editar_mensagem(p_mensagem_id uuid, p_texto text)
returns public.mensagens
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.mensagens := public.minha_mensagem_alteravel(p_mensagem_id);
  novo_texto text := btrim(coalesce(p_texto, ''));
begin
  if m.tipo <> 'texto' then
    raise exception 'Só dá para editar mensagens de texto.' using errcode = 'P0001';
  end if;
  if now() - m.criado_em > interval '15 minutes' then
    raise exception 'Passou o tempo para editar esta mensagem (15 minutos).' using errcode = 'P0001';
  end if;
  if novo_texto = '' or char_length(novo_texto) > 2000 then
    raise exception 'A mensagem precisa ter entre 1 e 2.000 caracteres.' using errcode = 'P0001';
  end if;

  update public.mensagens set texto = novo_texto, editada_em = now()
   where id = m.id
  returning * into m;
  return m;
end;
$$;

-- Devolve o endereço do arquivo que existia (áudio ou imagem), para o servidor tirar do R2.
create or replace function public.apagar_mensagem(p_mensagem_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.mensagens := public.minha_mensagem_alteravel(p_mensagem_id);
begin
  if now() - m.criado_em > interval '48 hours' then
    raise exception 'Passou o tempo para apagar esta mensagem (48 horas).' using errcode = 'P0001';
  end if;

  update public.mensagens
     set texto = null, arquivo_url = null, duracao_s = null, apagada_em = now()
   where id = m.id;
  return m.arquivo_url;
end;
$$;

-- Mensagem apagada não conta como não lida.
create or replace function public.conversas_nao_lidas()
returns table (conteudo_id uuid, cliente_id uuid, quantidade integer, ultima_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.conteudo_id, c.cliente_id, count(*)::integer, max(m.criado_em)
  from public.mensagens m
  join public.conteudos c on c.id = m.conteudo_id
  left join public.leituras l on l.conteudo_id = m.conteudo_id and l.user_id = (select auth.uid())
  where m.criado_em > coalesce(l.lida_ate, '-infinity'::timestamptz)
    and m.apagada_em is null
    and (
      (public.is_admin() and m.autor = 'cliente')
      or (not public.is_admin() and m.autor = 'bea'
          and c.cliente_id = public.meu_cliente_id() and c.status <> 'rascunho')
    )
  group by m.conteudo_id, c.cliente_id;
$$;

-- Caixa da Bea: agora sabe se a última mensagem foi apagada.
drop function public.caixa_de_mensagens();
create function public.caixa_de_mensagens()
returns table (
  conteudo_id uuid, titulo text, cliente_id uuid, cliente_nome text,
  autor text, tipo text, texto text, criado_em timestamptz, apagada boolean, nao_lidas integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with ultimas as (
    select distinct on (m.conteudo_id) m.conteudo_id, m.autor, m.tipo, m.texto, m.criado_em, m.apagada_em
    from public.mensagens m
    order by m.conteudo_id, m.criado_em desc
  )
  select u.conteudo_id, c.titulo, cl.id, cl.nome, u.autor, u.tipo, u.texto, u.criado_em,
         u.apagada_em is not null, coalesce(n.quantidade, 0)
  from ultimas u
  join public.conteudos c on c.id = u.conteudo_id
  join public.clientes cl on cl.id = c.cliente_id
  left join public.conversas_nao_lidas() n on n.conteudo_id = u.conteudo_id
  where public.is_admin()
  order by u.criado_em desc;
$$;

revoke execute on function public.minha_mensagem_alteravel(uuid) from public, anon, authenticated;
revoke execute on function public.editar_mensagem(uuid, text)    from public, anon;
revoke execute on function public.apagar_mensagem(uuid)          from public, anon;
revoke execute on function public.caixa_de_mensagens()           from public, anon;
grant  execute on function public.editar_mensagem(uuid, text)    to authenticated;
grant  execute on function public.apagar_mensagem(uuid)          to authenticated;
grant  execute on function public.caixa_de_mensagens()           to authenticated;
