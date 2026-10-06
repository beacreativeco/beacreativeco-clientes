-- =============================================================
-- Cliente aprova ou pede ajuste (página do cliente).
-- O cliente não tem UPDATE em conteudos: tudo passa por estas funções,
-- que só mexem em conteúdos dele que estão aguardando aprovação.
-- =============================================================

create or replace function public.aprovar_conteudo(p_conteudo_id uuid)
returns public.conteudos
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conteudos;
begin
  update public.conteudos
     set status          = 'aprovado',
         aprovado_em     = now(),
         aprovado_versao = versao_atual,
         aprovado_por    = 'cliente'
   where id = p_conteudo_id
     and cliente_id = public.meu_cliente_id()
     and status = 'em_aprovacao'
  returning * into c;

  if c.id is null then
    raise exception 'Este conteúdo não está esperando aprovação.' using errcode = 'P0001';
  end if;

  insert into public.mensagens (conteudo_id, versao, autor, tipo)
  values (c.id, c.versao_atual, 'cliente', 'aprovacao');

  return c;
end;
$$;

create or replace function public.pedir_ajuste(p_conteudo_id uuid, p_texto text)
returns public.conteudos
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conteudos;
  texto text := btrim(coalesce(p_texto, ''));
begin
  if texto = '' then
    raise exception 'Escreva o que você quer mudar.' using errcode = 'P0001';
  end if;
  if char_length(texto) > 2000 then
    raise exception 'O pedido passou de 2.000 caracteres.' using errcode = 'P0001';
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

  insert into public.mensagens (conteudo_id, versao, autor, tipo, texto)
  values (c.id, c.versao_atual, 'cliente', 'texto', texto);

  return c;
end;
$$;

revoke execute on function public.aprovar_conteudo(uuid)    from public, anon;
revoke execute on function public.pedir_ajuste(uuid, text)  from public, anon;
grant  execute on function public.aprovar_conteudo(uuid)    to authenticated;
grant  execute on function public.pedir_ajuste(uuid, text)  to authenticated;
