-- Trello → sistema (item 4b do roadmap).
-- Cada cartão das listas "[FEED]" do quadro de uma cliente vira um conteúdo. O vínculo
-- (conteudos.trello_card_id) já existia; aqui ele fica único, e o que só a Bea deve ver
-- (etapa pelas etiquetas, link do cartão, avisos da sincronização) vai em
-- conteudos_internos, que o cliente não lê (o RLS filtra linhas, não colunas).

create unique index conteudos_trello_card_id_unico
  on public.conteudos (trello_card_id)
  where trello_card_id is not null;

alter table public.conteudos_internos
  add column trello_url              text,
  add column trello_lista            text,
  add column trello_etiquetas        text[] not null default '{}',
  add column trello_aviso            text,
  add column trello_sincronizado_em  timestamptz;

-- Última sincronização de cada quadro (para mostrar "Atualizado às 15:32" no painel).
alter table public.clientes
  add column trello_sincronizado_em timestamptz;
