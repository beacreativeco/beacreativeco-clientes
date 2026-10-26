-- Desfaz supabase/migrations/20261026000000_suspenso_sem_mexer_em_mensagem.sql: as duas
-- funções voltam à versão da migração 20261019000000 (sem o coalesce; reabre a brecha do suspenso).
-- Fica fora de migrations/ para nunca rodar por engano.

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
