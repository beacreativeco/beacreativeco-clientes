-- =============================================================
-- Conversa por cliente (uma conversa só com a Bea, na aba Mensagens).
-- Cada mensagem passa a ser do cliente e pode (ou não) estar ligada a um conteúdo.
--
-- Compatível com a versão no ar (1.5.1), que usa o mesmo banco: quem insere só com
-- conteudo_id continua funcionando (o gatilho preenche o cliente), e as funções antigas
-- (marcar_conversa_lida, caixa_de_mensagens, mensagem_valida de 4 argumentos) ficam.
-- =============================================================

-- -------------------------------------------------------------
-- mensagens.cliente_id: de quem é a conversa
-- -------------------------------------------------------------
alter table public.mensagens
  add column cliente_id uuid references public.clientes (id) on delete cascade,
  -- Escrita pela Bea num rascunho: o cliente nunca vê (como sempre foi). Quem decide é o
  -- gatilho, na hora de inserir; depois não muda, então uma conversa que o cliente já viu
  -- continua visível se a Bea retirar o conteúdo da aprovação.
  add column so_bea boolean not null default false;

update public.mensagens m
   set cliente_id = c.cliente_id,
       so_bea     = (c.status = 'rascunho')
  from public.conteudos c
 where c.id = m.conteudo_id;

alter table public.mensagens alter column cliente_id set not null;

create index mensagens_cliente_idx on public.mensagens (cliente_id, criado_em);

-- Conteúdo agora é opcional. Se o conteúdo for excluído, a mensagem fica na conversa.
alter table public.mensagens alter column conteudo_id drop not null;
alter table public.mensagens drop constraint mensagens_conteudo_id_fkey;
alter table public.mensagens
  add constraint mensagens_conteudo_id_fkey
  foreign key (conteudo_id) references public.conteudos (id) on delete set null;

-- Com conteúdo: o cliente vem dele (e não pode ser outro) e a marca "só Bea" segue a situação.
-- Roda antes do RLS conferir a linha, então as policies já veem o cliente preenchido.
create or replace function public.mensagens_preencher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conteudos;
begin
  new.so_bea := false;
  if new.conteudo_id is not null then
    select * into c from public.conteudos where id = new.conteudo_id;
    if c.id is null then
      raise exception 'Conteúdo não encontrado.' using errcode = 'P0001';
    end if;
    if new.cliente_id is null then
      new.cliente_id := c.cliente_id;
    elsif new.cliente_id <> c.cliente_id then
      raise exception 'Este conteúdo é de outro cliente.' using errcode = 'P0001';
    end if;
    new.so_bea := c.status = 'rascunho';
  end if;
  return new;
end;
$$;

create trigger mensagens_preencher
  before insert on public.mensagens
  for each row execute function public.mensagens_preencher();

-- -------------------------------------------------------------
-- Forma de uma mensagem, agora sabendo o cliente
-- -------------------------------------------------------------
-- Arquivo: da pasta da conversa do conteúdo (como antes) ou, sem conteúdo, da pasta da
-- conversa do cliente (conversa/<cliente_id>/, apagada pelo R2 30 dias depois).
create or replace function public.mensagem_valida(
  p_cliente_id uuid, p_conteudo_id uuid, p_tipo text, p_texto text, p_arquivo_url text
)
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
      else coalesce(p_arquivo_url, '') ~ (
        '^/api/midia/conversa/' || p_cliente_id::text || '/[0-9a-f-]+\.(jpg|m4a|webm)$'
      )
      or (p_conteudo_id is not null and coalesce(p_arquivo_url, '') ~ (
        '^/api/midia/((trabalho|aprovados|vitrine)/)?' || p_conteudo_id::text || '/conversa/[0-9a-f-]+\.(jpg|m4a|webm|mp4)$'
      ))
    end;
$$;

-- -------------------------------------------------------------
-- Quem lê e escreve
-- -------------------------------------------------------------
drop policy "cliente lê mensagens dos próprios conteúdos" on public.mensagens;
create policy "cliente lê a própria conversa" on public.mensagens
  for select to authenticated
  using (cliente_id = public.meu_cliente_id() and not so_bea);

drop policy "cliente envia mensagem nos próprios conteúdos" on public.mensagens;
create policy "cliente envia mensagem na própria conversa" on public.mensagens
  for insert to authenticated
  with check (
    cliente_id = public.meu_cliente_id()
    and autor = 'cliente'
    and not pedido_ajuste
    and not so_bea
    and (conteudo_id is null or public.cliente_ve_conteudo(conteudo_id))
    and public.mensagem_valida(cliente_id, conteudo_id, tipo, texto, arquivo_url)
  );

drop policy "admin envia mensagem como bea" on public.mensagens;
create policy "admin envia mensagem como bea" on public.mensagens
  for insert to authenticated
  with check (
    public.is_admin()
    and autor = 'bea'
    and not pedido_ajuste
    and public.mensagem_valida(cliente_id, conteudo_id, tipo, texto, arquivo_url)
  );

-- Editar/apagar: a mensagem do cliente é dele pela conversa, não mais pelo conteúdo.
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
       or (m.autor = 'cliente' and not public.is_admin()
           and m.cliente_id = public.meu_cliente_id() and not m.so_bea)
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

-- -------------------------------------------------------------
-- Leituras da conversa do cliente
-- -------------------------------------------------------------
-- Uma mensagem conta como lida se foi vista na conversa do cliente OU na conversa
-- filtrada no conteúdo dela (a tabela leituras, por conteúdo, continua valendo).
create table public.leituras_cliente (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  lida_ate   timestamptz not null default now(),
  primary key (cliente_id, user_id)
);

-- Sem policy: só as funções abaixo leem e escrevem.
alter table public.leituras_cliente enable row level security;

create or replace function public.marcar_conversa_do_cliente_lida(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or p_cliente_id = public.meu_cliente_id()) then
    raise exception 'Conversa não encontrada.' using errcode = 'P0001';
  end if;
  insert into public.leituras_cliente (cliente_id, user_id, lida_ate)
  values (p_cliente_id, (select auth.uid()), now())
  on conflict (cliente_id, user_id) do update set lida_ate = excluded.lida_ate;
end;
$$;

-- Mensagens da outra pessoa ainda não lidas, por conteúdo (null = sem conteúdo) e cliente.
-- Mesma assinatura de antes: a versão no ar continua somando igual.
create or replace function public.conversas_nao_lidas()
returns table (conteudo_id uuid, cliente_id uuid, quantidade integer, ultima_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.conteudo_id, m.cliente_id, count(*)::integer, max(m.criado_em)
  from public.mensagens m
  left join public.leituras l
    on l.conteudo_id = m.conteudo_id and l.user_id = (select auth.uid())
  left join public.leituras_cliente lc
    on lc.cliente_id = m.cliente_id and lc.user_id = (select auth.uid())
  where m.criado_em > greatest(coalesce(l.lida_ate, '-infinity'::timestamptz),
                               coalesce(lc.lida_ate, '-infinity'::timestamptz))
    and m.apagada_em is null
    and (
      (public.is_admin() and m.autor = 'cliente')
      or (not public.is_admin() and m.autor = 'bea'
          and m.cliente_id = public.meu_cliente_id() and not m.so_bea)
    )
  group by m.conteudo_id, m.cliente_id;
$$;

-- Aba Mensagens da Bea: um item por cliente (os que nunca conversaram vão para o fim,
-- em ordem alfabética, para ela poder começar a conversa).
create or replace function public.conversas_por_cliente()
returns table (
  cliente_id uuid, cliente_nome text, foto_url text,
  conteudo_id uuid, conteudo_titulo text,
  autor text, tipo text, texto text, pedido_ajuste boolean, criado_em timestamptz, apagada boolean,
  nao_lidas integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with ultimas as (
    select distinct on (m.cliente_id) m.cliente_id, m.conteudo_id, m.autor, m.tipo, m.texto,
           m.pedido_ajuste, m.criado_em, m.apagada_em
    from public.mensagens m
    order by m.cliente_id, m.criado_em desc
  ),
  pendentes as (
    select n.cliente_id, sum(n.quantidade)::integer as quantidade
    from public.conversas_nao_lidas() n
    group by n.cliente_id
  )
  select cl.id, cl.nome, coalesce(cl.foto_perfil, cl.contato_foto_url),
         u.conteudo_id, c.titulo,
         u.autor, u.tipo, u.texto, coalesce(u.pedido_ajuste, false), u.criado_em,
         u.apagada_em is not null, coalesce(n.quantidade, 0)
  from public.clientes cl
  left join ultimas u on u.cliente_id = cl.id
  left join public.conteudos c on c.id = u.conteudo_id
  left join pendentes n on n.cliente_id = cl.id
  where public.is_admin() and cl.arquivado_em is null
  order by u.criado_em desc nulls last, cl.nome;
$$;

-- -------------------------------------------------------------
-- Permissões
-- -------------------------------------------------------------
revoke execute on function public.mensagem_valida(uuid, uuid, text, text, text)         from public, anon;
revoke execute on function public.marcar_conversa_do_cliente_lida(uuid)                 from public, anon;
revoke execute on function public.conversas_por_cliente()                               from public, anon;
grant  execute on function public.mensagem_valida(uuid, uuid, text, text, text)         to authenticated;
grant  execute on function public.marcar_conversa_do_cliente_lida(uuid)                 to authenticated;
grant  execute on function public.conversas_por_cliente()                               to authenticated;
