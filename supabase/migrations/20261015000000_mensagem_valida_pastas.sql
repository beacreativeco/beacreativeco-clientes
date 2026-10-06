-- Correção da 0.9.0: os arquivos da conversa passaram a ter a pasta na frente
-- (/api/midia/trabalho/<conteudo_id>/conversa/...), mas mensagem_valida só aceitava o
-- caminho antigo (/api/midia/<conteudo_id>/conversa/...). Resultado: imagem e áudio na
-- conversa eram recusados. Agora aceita as três pastas e o formato antigo, sempre da
-- pasta da conversa DESTE conteúdo.

create or replace function public.mensagem_valida(p_conteudo_id uuid, p_tipo text, p_texto text, p_arquivo_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_tipo in ('texto', 'audio', 'referencia')
    and (p_texto is null or char_length(p_texto) <= 2000)
    and case
      when p_tipo = 'texto' then btrim(coalesce(p_texto, '')) <> '' and p_arquivo_url is null
      else coalesce(p_arquivo_url, '') ~ (
        '^/api/midia/((trabalho|aprovados|vitrine)/)?' || p_conteudo_id::text || '/conversa/[0-9a-f-]+\.(jpg|m4a|webm|mp4)$'
      )
    end;
$$;
