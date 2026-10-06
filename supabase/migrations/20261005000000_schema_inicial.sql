-- =============================================================
-- Sistema de Aprovação BeaCreative - schema inicial (Fase 1)
-- Tabelas, tipos, funções auxiliares e RLS.
-- =============================================================

-- -------------------------------------------------------------
-- Tipos
-- -------------------------------------------------------------
create type public.status_conteudo as enum (
  'rascunho',
  'em_aprovacao',
  'ajuste_solicitado',
  'aprovado'
);

create type public.formato_conteudo as enum ('post', 'carrossel', 'story', 'reels');

create type public.tipo_midia as enum ('imagem', 'video');

-- -------------------------------------------------------------
-- Tabelas
-- -------------------------------------------------------------

-- Quem é admin. Só se insere aqui pelo SQL Editor (não há policy de insert).
create table public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table public.clientes (
  id                        uuid primary key default gen_random_uuid(),
  nome                      text not null,
  slug                      text not null unique,
  logo                      text,
  foto_perfil               text,
  instagram                 text,
  whatsapp                  text,
  email                     text,
  drive_pasta_url           text,
  trello_board_id           text,
  contrato_ativo            boolean not null default true,
  contrato_inicio           date,
  login_ativo               boolean not null default true,
  prazo_padrao_dias         integer not null default 2 check (prazo_padrao_dias >= 0),
  aprovacao_automatica_dias integer check (aprovacao_automatica_dias >= 0),
  user_id                   uuid unique references auth.users (id) on delete set null,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now()
);

create table public.conteudos (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null references public.clientes (id) on delete cascade,
  titulo               text not null,
  formato              public.formato_conteudo not null,
  legenda              text,
  data_prevista        date,
  prazo_aprovacao      timestamptz,
  aprovacao_automatica boolean not null default false,
  aprovado_por         text check (aprovado_por in ('cliente', 'prazo')),
  aprovado_em          timestamptz,
  aprovado_versao      integer,
  drive_url            text,
  status               public.status_conteudo not null default 'rascunho',
  versao_atual         integer not null default 1 check (versao_atual >= 1),
  na_vitrine           boolean not null default false,
  trello_card_id       text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

-- observacao_interna fica separada: RLS filtra linhas, não colunas.
-- Se ficasse em conteudos, o cliente que vê a linha veria a coluna.
create table public.conteudos_internos (
  conteudo_id        uuid primary key references public.conteudos (id) on delete cascade,
  observacao_interna text,
  atualizado_em      timestamptz not null default now()
);

create table public.midias (
  id            uuid primary key default gen_random_uuid(),
  conteudo_id   uuid not null references public.conteudos (id) on delete cascade,
  versao        integer not null default 1,
  tipo          public.tipo_midia not null,
  arquivo_url   text not null,
  otimizado_url text,
  tamanho_mb    numeric(10, 2),
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now()
);

create table public.mensagens (
  id          uuid primary key default gen_random_uuid(),
  conteudo_id uuid not null references public.conteudos (id) on delete cascade,
  versao      integer not null default 1,
  autor       text not null check (autor in ('bea', 'cliente')),
  tipo        text not null check (tipo in ('texto', 'audio', 'referencia', 'aprovacao')),
  texto       text,
  arquivo_url text,
  criado_em   timestamptz not null default now()
);

create table public.notificacoes (
  id           uuid primary key default gen_random_uuid(),
  destinatario uuid not null references auth.users (id) on delete cascade,
  conteudo_id  uuid references public.conteudos (id) on delete cascade,
  canal        text not null check (canal in ('email', 'app', 'push')),
  lida         boolean not null default false,
  criado_em    timestamptz not null default now()
);

create table public.depoimentos (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes (id) on delete cascade,
  texto            text not null,
  nome_autor       text,
  cargo            text,
  liberado_vitrine boolean not null default false,
  criado_em        timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Índices
-- -------------------------------------------------------------
create index conteudos_cliente_idx      on public.conteudos (cliente_id);
create index conteudos_status_idx       on public.conteudos (status);
create index midias_conteudo_idx        on public.midias (conteudo_id, versao, ordem);
create index mensagens_conteudo_idx     on public.mensagens (conteudo_id, criado_em);
create index notificacoes_dest_idx      on public.notificacoes (destinatario, lida);
create index depoimentos_cliente_idx    on public.depoimentos (cliente_id);

-- -------------------------------------------------------------
-- atualizado_em automático
-- -------------------------------------------------------------
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.tocar_atualizado_em();

create trigger conteudos_atualizado_em
  before update on public.conteudos
  for each row execute function public.tocar_atualizado_em();

create trigger conteudos_internos_atualizado_em
  before update on public.conteudos_internos
  for each row execute function public.tocar_atualizado_em();

-- -------------------------------------------------------------
-- Funções auxiliares para as policies
-- security definer: leem as tabelas sem passar pelo RLS (evita recursão).
-- -------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- id do cliente logado, ou null se não for cliente ou estiver suspenso.
create or replace function public.meu_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.clientes
  where user_id = (select auth.uid())
    and login_ativo;
$$;

-- O cliente logado pode ver este conteúdo? (dono + fora de rascunho)
create or replace function public.cliente_ve_conteudo(p_conteudo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conteudos c
    where c.id = p_conteudo_id
      and c.cliente_id = public.meu_cliente_id()
      and c.status <> 'rascunho'
  );
$$;

revoke execute on function public.is_admin()                 from public, anon;
revoke execute on function public.meu_cliente_id()           from public, anon;
revoke execute on function public.cliente_ve_conteudo(uuid)  from public, anon;
grant  execute on function public.is_admin()                 to authenticated;
grant  execute on function public.meu_cliente_id()           to authenticated;
grant  execute on function public.cliente_ve_conteudo(uuid)  to authenticated;

-- -------------------------------------------------------------
-- RLS
-- Sem policy = sem acesso. anon não tem nenhuma policy (vitrine fica pra Fase 3).
-- -------------------------------------------------------------
alter table public.admins             enable row level security;
alter table public.clientes           enable row level security;
alter table public.conteudos          enable row level security;
alter table public.conteudos_internos enable row level security;
alter table public.midias             enable row level security;
alter table public.mensagens          enable row level security;
alter table public.notificacoes       enable row level security;
alter table public.depoimentos        enable row level security;

-- admins: cada um só confere a própria linha (o front usa pra saber se é admin)
create policy "admin vê a própria linha" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- clientes
create policy "admin gerencia clientes" on public.clientes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cliente lê o próprio cadastro" on public.clientes
  for select to authenticated
  using (id = public.meu_cliente_id());

-- conteudos
create policy "admin gerencia conteúdos" on public.conteudos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cliente lê os próprios conteúdos fora de rascunho" on public.conteudos
  for select to authenticated
  using (cliente_id = public.meu_cliente_id() and status <> 'rascunho');
-- Cliente não faz UPDATE direto: aprovar/pedir ajuste vai ser via função (RPC).

-- conteudos_internos: só admin
create policy "admin gerencia notas internas" on public.conteudos_internos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- midias
create policy "admin gerencia mídias" on public.midias
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cliente lê mídias dos próprios conteúdos" on public.midias
  for select to authenticated
  using (public.cliente_ve_conteudo(conteudo_id));

-- mensagens
create policy "admin gerencia mensagens" on public.mensagens
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cliente lê mensagens dos próprios conteúdos" on public.mensagens
  for select to authenticated
  using (public.cliente_ve_conteudo(conteudo_id));

-- Cliente só escreve como 'cliente'; mensagem de aprovação vem da RPC de aprovar.
create policy "cliente envia mensagem nos próprios conteúdos" on public.mensagens
  for insert to authenticated
  with check (
    public.cliente_ve_conteudo(conteudo_id)
    and autor = 'cliente'
    and tipo in ('texto', 'audio', 'referencia')
  );

-- notificacoes: cada um vê as suas e só pode marcar como lida
create policy "usuário lê as próprias notificações" on public.notificacoes
  for select to authenticated
  using (destinatario = (select auth.uid()));

create policy "usuário marca as próprias notificações" on public.notificacoes
  for update to authenticated
  using (destinatario = (select auth.uid()))
  with check (destinatario = (select auth.uid()));

revoke update on public.notificacoes from authenticated;
grant  update (lida) on public.notificacoes to authenticated;
-- Criação de notificações: só no servidor (service_role, Pages Functions).

-- depoimentos: só admin por enquanto
create policy "admin gerencia depoimentos" on public.depoimentos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
