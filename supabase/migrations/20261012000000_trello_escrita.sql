-- Sistema → Trello (item 4b do roadmap).
-- Depois que algo acontece num conteúdo ligado a um cartão (enviado ao cliente, aprovado,
-- pedido de ajuste), /api/trello/refletir leva isso ao cartão: etiquetas, comentários e o
-- link do sistema. Estas colunas evitam repetir comentário e anexo.

alter table public.conteudos_internos
  -- Eventos da conversa (aprovação, pedido de ajuste) até este momento já viraram comentário.
  -- Começa em "agora": o que aconteceu antes de ligar ao Trello não é comentado.
  add column trello_refletido_ate timestamptz not null default now(),
  -- O cartão já tem o anexo "Abrir no sistema de aprovação".
  add column trello_anexado boolean not null default false;
