-- Perfil do cliente (item 5d do ROADMAP.md): nome e foto de quem aprova os conteúdos,
-- mostrados à Bea nos balões da conversa. A foto e o @ da prévia (foto_perfil, instagram)
-- continuam sendo da Bea; o cliente não mexe neles.

-- -------------------------------------------------------------
-- Nome e foto de quem aprova
-- -------------------------------------------------------------
-- A foto fica no R2 em perfil/<uuid>.jpg e é gravada pelo servidor (/api/perfil/foto).
alter table public.clientes
  add column contato_nome     text,
  add column contato_foto_url text;

-- -------------------------------------------------------------
-- O cliente troca só o próprio nome de contato
-- -------------------------------------------------------------
-- security definer: o cliente não tem UPDATE em clientes (só a admin edita o cadastro).
create or replace function public.salvar_meu_nome(p_nome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := nullif(btrim(p_nome), '');
begin
  if char_length(v_nome) > 80 then
    raise exception 'O nome pode ter até 80 caracteres.' using errcode = 'P0001';
  end if;
  update public.clientes
     set contato_nome = v_nome
   where id = public.meu_cliente_id();
  if not found then
    raise exception 'Seu acesso não está ativo no momento.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.salvar_meu_nome(text) from public, anon;
grant execute on function public.salvar_meu_nome(text) to authenticated;
