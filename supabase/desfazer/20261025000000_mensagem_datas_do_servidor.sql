-- Desfaz supabase/migrations/20261025000000_mensagem_datas_do_servidor.sql: o gatilho volta
-- a aceitar as datas que vêm na inserção e sai a regra do tamanho do arquivo.
-- Fica fora de migrations/ para nunca rodar por engano.

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

alter table public.mensagens drop constraint if exists mensagens_arquivo_mb_valido;
