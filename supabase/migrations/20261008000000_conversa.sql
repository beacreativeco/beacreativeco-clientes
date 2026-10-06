-- =============================================================
-- Conversa por conteúdo (estilo WhatsApp): texto, áudio, imagem.
-- Não lidas, pedido de ajuste como primeira mensagem e Realtime.
-- =============================================================

-- -------------------------------------------------------------
-- mensagens: duração do áudio e marca do pedido de ajuste
-- -------------------------------------------------------------
alter table public.mensagens
  add column duracao_s     numeric(5, 1) check (duracao_s is null or duracao_s between 0 and 180),
  add column pedido_ajuste boolean not null default false;

-- Regras de forma de uma mensagem (usadas pela policy e pela função pedir_ajuste).
-- texto: precisa de texto, sem arquivo. audio/referencia: precisa do arquivo da conversa.
create or replace function public.mensagem_valida(p_conteudo_id uuid, p_tipo text, p_texto text, p_arquivo_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_tipo in ('texto', 'audio', 'referencia')
    and (p_texto is null or char_length(p_texto) <= 2000)
    and case
      when p_tipo = 'texto' then btrim(coalesce(p_texto, '')) <> '' and p_arquivo_url is null
      else p_arquivo_url like '/api/midia/' || p_conteudo_id::text || '/conversa/%'
    end;
$$;

-- Cliente: só nos próprios conteúdos, só como 'cliente', nunca marca pedido de ajuste
-- (isso é da função pedir_ajuste) e só anexa arquivo da pasta da conversa deste conteúdo.
drop policy "cliente envia mensagem nos próprios conteúdos" on public.mensagens;
create policy "cliente envia mensagem nos próprios conteúdos" on public.mensagens
  for insert to authenticated
  with check (
    public.cliente_ve_conteudo(conteudo_id)
    and autor = 'cliente'
    and not pedido_ajuste
    and public.mensagem_valida(conteudo_id, tipo, texto, arquivo_url)
  );

-- -------------------------------------------------------------
-- Leituras: até quando cada pessoa leu cada conversa
-- -------------------------------------------------------------
create table public.leituras (
  conteudo_id uuid not null references public.conteudos (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  lida_ate    timestamptz not null default now(),
  primary key (conteudo_id, user_id)
);

-- Sem policy: só as funções abaixo leem e escrevem.
alter table public.leituras enable row level security;

create or replace function public.marcar_conversa_lida(p_conteudo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.cliente_ve_conteudo(p_conteudo_id)) then
    raise exception 'Conversa não encontrada.' using errcode = 'P0001';
  end if;
  insert into public.leituras (conteudo_id, user_id, lida_ate)
  values (p_conteudo_id, (select auth.uid()), now())
  on conflict (conteudo_id, user_id) do update set lida_ate = excluded.lida_ate;
end;
$$;

-- Mensagens da outra pessoa ainda não lidas, por conteúdo.
-- Bea: o que os clientes mandaram. Cliente: o que a Bea mandou nos conteúdos dele.
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
    and (
      (public.is_admin() and m.autor = 'cliente')
      or (not public.is_admin() and m.autor = 'bea'
          and c.cliente_id = public.meu_cliente_id() and c.status <> 'rascunho')
    )
  group by m.conteudo_id, c.cliente_id;
$$;

-- Caixa de mensagens da Bea: uma linha por conversa, a mais recente primeiro.
create or replace function public.caixa_de_mensagens()
returns table (
  conteudo_id uuid, titulo text, cliente_id uuid, cliente_nome text,
  autor text, tipo text, texto text, criado_em timestamptz, nao_lidas integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with ultimas as (
    select distinct on (m.conteudo_id) m.conteudo_id, m.autor, m.tipo, m.texto, m.criado_em
    from public.mensagens m
    order by m.conteudo_id, m.criado_em desc
  )
  select u.conteudo_id, c.titulo, cl.id, cl.nome, u.autor, u.tipo, u.texto, u.criado_em,
         coalesce(n.quantidade, 0)
  from ultimas u
  join public.conteudos c on c.id = u.conteudo_id
  join public.clientes cl on cl.id = c.cliente_id
  left join public.conversas_nao_lidas() n on n.conteudo_id = u.conteudo_id
  where public.is_admin()
  order by u.criado_em desc;
$$;

-- -------------------------------------------------------------
-- Pedir ajuste: a mensagem (texto, áudio ou imagem) vira o pedido
-- -------------------------------------------------------------
drop function public.pedir_ajuste(uuid, text);

create or replace function public.pedir_ajuste(
  p_conteudo_id uuid,
  p_tipo        text default 'texto',
  p_texto       text default null,
  p_arquivo_url text default null,
  p_duracao_s   numeric default null
)
returns public.conteudos
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conteudos;
  texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if not public.mensagem_valida(p_conteudo_id, p_tipo, texto, p_arquivo_url) then
    raise exception 'Escreva, grave ou anexe o que você quer mudar.' using errcode = 'P0001';
  end if;

  update public.conteudos
     set status          = 'ajuste_solicitado',
         prazo_aprovacao = null
   where id = p_conteudo_id
     and cliente_id = public.meu_cliente_id()
     and status = 'em_aprovacao'
  returning * into c;

  if c.id is null then
    raise exception 'Este conteúdo não está esperando aprovação.' using errcode = 'P0001';
  end if;

  insert into public.mensagens (conteudo_id, versao, autor, tipo, texto, arquivo_url, duracao_s, pedido_ajuste)
  values (c.id, c.versao_atual, 'cliente', p_tipo, texto, p_arquivo_url, p_duracao_s, true);

  return c;
end;
$$;

-- Mensagens antigas de pedido de ajuste (item 2) passam a ter a marca.
update public.mensagens set pedido_ajuste = true
 where autor = 'cliente' and tipo = 'texto'
   and conteudo_id in (select id from public.conteudos where status = 'ajuste_solicitado');

-- -------------------------------------------------------------
-- Permissões das funções
-- -------------------------------------------------------------
revoke execute on function public.mensagem_valida(uuid, text, text, text)            from public, anon;
revoke execute on function public.marcar_conversa_lida(uuid)                         from public, anon;
revoke execute on function public.conversas_nao_lidas()                              from public, anon;
revoke execute on function public.caixa_de_mensagens()                               from public, anon;
revoke execute on function public.pedir_ajuste(uuid, text, text, text, numeric)      from public, anon;
grant  execute on function public.mensagem_valida(uuid, text, text, text)            to authenticated;
grant  execute on function public.marcar_conversa_lida(uuid)                         to authenticated;
grant  execute on function public.conversas_nao_lidas()                              to authenticated;
grant  execute on function public.caixa_de_mensagens()                               to authenticated;
grant  execute on function public.pedir_ajuste(uuid, text, text, text, numeric)      to authenticated;

-- -------------------------------------------------------------
-- Realtime: mensagens novas chegam na hora (o Realtime respeita o RLS)
-- -------------------------------------------------------------
alter publication supabase_realtime add table public.mensagens;
