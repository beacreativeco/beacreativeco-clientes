-- =============================================================
-- Notificações push, entrega 3: prazo de aprovação vencendo amanhã.
-- Todo dia às 9h de Brasília (12h UTC; Brasília é UTC−3 o ano todo), o pg_cron chama
-- POST /api/push/evento { tipo: 'prazos' } nos destinos de push_destinos. O servidor procura
-- os conteúdos ainda esperando aprovação com prazo amanhã e avisa cada cliente uma vez
-- (push_eventos: 'prazo:<conteudo>:<prazo>').
-- =============================================================

create extension if not exists pg_cron;

-- Rodar de novo esta migração não duplica o agendamento.
select cron.unschedule(jobid) from cron.job where jobname = 'push-prazos';

select cron.schedule(
  'push-prazos',
  '0 12 * * *',
  $$select public.push_avisar('{"tipo": "prazos"}'::jsonb)$$
);
