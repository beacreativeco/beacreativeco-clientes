-- =============================================================
-- Notificações push (item 10): os aparelhos de cada pessoa que aceitaram receber avisos.
-- Uma linha por aparelho (navegador) inscrito; a mesma conta pode ter vários.
-- O servidor lê com a chave de serviço para enviar e apaga os que deixaram de existir.
-- =============================================================

create table public.push_aparelhos (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  endpoint  text not null unique check (endpoint like 'https://%'),
  p256dh    text not null,
  auth      text not null,
  nome      text check (nome is null or char_length(nome) <= 80), -- "Chrome no Android"
  criado_em timestamptz not null default now(),
  usado_em  timestamptz                                            -- último aviso entregue
);

create index push_aparelhos_user_idx on public.push_aparelhos (user_id);

alter table public.push_aparelhos enable row level security;

-- Cada um vê e remove só os próprios aparelhos (a seção Notificações do perfil).
-- Para incluir, só pela função abaixo.
create policy "vê os próprios aparelhos" on public.push_aparelhos
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "remove os próprios aparelhos" on public.push_aparelhos
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Inscreve este aparelho para quem está logado. Se o mesmo navegador estava com outra
-- conta (ex.: saiu e entrou com outro login), passa a ser só desta.
create or replace function public.registrar_aparelho(p_endpoint text, p_p256dh text, p_auth text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Entre de novo para ativar as notificações.' using errcode = 'P0001';
  end if;
  if not (public.is_admin() or public.meu_cliente_id() is not null) then
    raise exception 'Sua conta não pode receber notificações.' using errcode = 'P0001';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Inscrição de notificações inválida.' using errcode = 'P0001';
  end if;

  insert into public.push_aparelhos (user_id, endpoint, p256dh, auth, nome)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_nome, 80))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        nome = excluded.nome
  returning id into novo;
  return novo;
end;
$$;

revoke execute on function public.registrar_aparelho(text, text, text, text) from public, anon;
grant  execute on function public.registrar_aparelho(text, text, text, text) to authenticated;
