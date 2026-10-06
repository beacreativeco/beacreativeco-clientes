-- Forma da onda dos áudios da conversa, calculada no navegador na hora de gravar
-- (altura de cada barra de 0 a 100). Fica guardada para o balão não processar o áudio toda vez.

alter table public.mensagens
  add column onda smallint[] check (
    onda is null or (cardinality(onda) between 1 and 64 and 0 <= all (onda) and 100 >= all (onda))
  );

-- -------------------------------------------------------------
-- Pedir ajuste com áudio também guarda a onda
-- -------------------------------------------------------------
drop function public.pedir_ajuste(uuid, text, text, text, numeric);

create or replace function public.pedir_ajuste(
  p_conteudo_id uuid,
  p_tipo        text default 'texto',
  p_texto       text default null,
  p_arquivo_url text default null,
  p_duracao_s   numeric default null,
  p_onda        smallint[] default null
)
returns public.conteudos
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conteudos;
  texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if not public.mensagem_valida(p_conteudo_id, p_tipo, texto, p_arquivo_url) then
    raise exception 'Escreva, grave ou anexe o que você quer mudar.' using errcode = 'P0001';
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

  insert into public.mensagens (conteudo_id, versao, autor, tipo, texto, arquivo_url, duracao_s, onda, pedido_ajuste)
  values (c.id, c.versao_atual, 'cliente', p_tipo, texto, p_arquivo_url, p_duracao_s,
          case when p_tipo = 'audio' then p_onda end, true);

  return c;
end;
$$;

revoke execute on function public.pedir_ajuste(uuid, text, text, text, numeric, smallint[]) from public, anon;
grant  execute on function public.pedir_ajuste(uuid, text, text, text, numeric, smallint[]) to authenticated;
