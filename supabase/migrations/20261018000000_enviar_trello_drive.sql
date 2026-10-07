-- Enviar arquivos pro Trello e pro Drive (item 5g do ROADMAP.md): registro em cada mídia,
-- para o editor mostrar "✓ No Trello" / "✓ No Drive" e não mandar duas vezes sem querer.
--
-- Trello: gravado pelo servidor (/api/trello/anexar, chave secreta), nunca pelo navegador.
-- Drive: gravado pelo navegador da Bea depois do envio direto ao Google (a política
-- "admin gerencia mídias" já deixa a admin atualizar a linha).
-- O cliente lê estas colunas junto com a mídia (RLS filtra linhas, não colunas): são só
-- ids e links de anexos da própria agência, sem nada sigiloso.

alter table public.midias
  add column trello_anexo_id   text,
  add column trello_anexo_url  text,
  add column trello_enviado_em timestamptz,
  -- 'arquivo' (até 10 MB, limite do Trello grátis) ou 'link' (acima disso, link do sistema)
  add column trello_como       text check (trello_como in ('arquivo', 'link')),
  add column drive_arquivo_id  text,
  add column drive_arquivo_url text,
  add column drive_enviado_em  timestamptz,
  -- true = foi o original em alta qualidade; false = a versão comprimida do sistema
  add column drive_original    boolean;
