-- =============================================================
-- Revisão de segurança, etapa 2 (dados): quem insere uma mensagem não escolhe as datas.
-- Antes, o navegador podia mandar criado_em, editada_em e apagada_em junto com a mensagem:
-- com criado_em no futuro, o cliente editava/apagava fora dos 15 min / 48 h, deixava a
-- mensagem sempre no topo e "não lida" para a Bea; com apagada_em, criava uma "Mensagem apagada".
-- E arquivo_mb negativo deixava o espaço usado do painel menor do que é.
-- Desfazer: supabase/desfazer/20261025000000_mensagem_datas_do_servidor.sql
-- =============================================================

create or replace function public.mensagens_preencher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conteudos;
begin
  new.so_bea      := false;
  new.criado_em   := now();
  new.editada_em  := null;
  new.apagada_em  := null;
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

-- create or replace mantém as permissões, mas fica explícito (igual à migração 20261024000000).
revoke execute on function public.mensagens_preencher() from public, anon, authenticated;

-- Arquivos da conversa vão até 8 MB (imagem) e 5 MB (áudio).
alter table public.mensagens
  add constraint mensagens_arquivo_mb_valido check (arquivo_mb is null or arquivo_mb between 0 and 10);
