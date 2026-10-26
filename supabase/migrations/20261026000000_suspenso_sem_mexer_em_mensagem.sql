-- =============================================================
-- Achado pelos testes de RLS (testes/rls.test.js): para quem não é cliente ativo nem a Bea
-- (cliente suspenso, por exemplo), meu_cliente_id() é null, então "m.cliente_id = null" dá
-- null, o "if not (...)" não dispara e a checagem de dono passava. Com o id de uma mensagem
-- de cliente, um suspenso conseguia editar (15 min) ou apagar (48 h) a mensagem de qualquer
-- cliente. coalesce(..., false): null vira "não pode".
-- O mesmo padrão em marcar_conversa_do_cliente_lida (inofensivo: só grava a leitura de quem chama).
-- Desfazer: supabase/desfazer/20261026000000_suspenso_sem_mexer_em_mensagem.sql
-- =============================================================

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
     or not coalesce(
       (m.autor = 'bea' and public.is_admin())
       or (m.autor = 'cliente' and not public.is_admin()
           and m.cliente_id = public.meu_cliente_id() and not m.so_bea),
       false
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

create or replace function public.marcar_conversa_do_cliente_lida(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.is_admin() or p_cliente_id = public.meu_cliente_id(), false) then
    raise exception 'Conversa não encontrada.' using errcode = 'P0001';
  end if;
  insert into public.leituras_cliente (cliente_id, user_id, lida_ate)
  values (p_cliente_id, (select auth.uid()), now())
  on conflict (cliente_id, user_id) do update set lida_ate = excluded.lida_ate;
end;
$$;

-- create or replace mantém as permissões; fica explícito (igual à migração 20261024000000).
revoke execute on function public.minha_mensagem_alteravel(uuid)        from public, anon, authenticated;
revoke execute on function public.marcar_conversa_do_cliente_lida(uuid) from public, anon;
grant  execute on function public.marcar_conversa_do_cliente_lida(uuid) to authenticated;
