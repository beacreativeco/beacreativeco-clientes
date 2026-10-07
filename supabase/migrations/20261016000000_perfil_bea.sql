-- Perfil da Bea (item 5c do ROADMAP.md): nome e foto da admin, dados da agência
-- e o que os clientes podem ver dela na conversa (nome e foto, nunca o e-mail).

-- -------------------------------------------------------------
-- Nome e foto da admin
-- -------------------------------------------------------------
-- A foto fica no R2 em perfil/<uuid>.jpg e é gravada pelo servidor (/api/perfil/foto).
alter table public.admins
  add column nome     text,
  add column foto_url text;

create policy "admin edita o próprio perfil" on public.admins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -------------------------------------------------------------
-- Dados da agência (uma linha só)
-- -------------------------------------------------------------
-- Usados no envio do link (5e) e nos e-mails aos clientes (6).
create table public.agencia (
  id            boolean primary key default true check (id),
  nome          text,
  whatsapp      text,
  instagram     text,
  email_contato text,
  atualizado_em timestamptz not null default now()
);

alter table public.agencia enable row level security;

create policy "admin gerencia a agência" on public.agencia
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.agencia (id, nome) values (true, 'BeaCreative') on conflict (id) do nothing;

-- -------------------------------------------------------------
-- O que o cliente vê da Bea: nome e foto (para os balões da conversa)
-- -------------------------------------------------------------
-- security definer: o RLS de admins só mostra a própria linha.
create or replace function public.perfil_bea()
returns table (nome text, foto_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.nome, a.foto_url from public.admins a order by a.criado_em limit 1;
$$;

revoke execute on function public.perfil_bea() from public, anon;
grant execute on function public.perfil_bea() to authenticated;
