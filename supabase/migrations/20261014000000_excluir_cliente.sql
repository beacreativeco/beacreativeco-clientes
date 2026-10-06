-- Excluir cliente (item 5b do roadmap).
-- Normalmente o cadastro é apagado de vez (com conteúdos, conversas e depoimentos, em cascata).
-- Se a Bea escolher manter os conteúdos da vitrine, o cadastro fica arquivado: sem login, sem
-- contato, fora das listas do painel, guardando só o que a vitrine precisa (nome e logo).

alter table public.clientes
  add column arquivado_em timestamptz;
