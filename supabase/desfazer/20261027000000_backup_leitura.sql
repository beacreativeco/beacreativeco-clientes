-- Desfaz supabase/migrations/20261027000000_backup_leitura.sql: o usuário do backup deixa de existir
-- (o backup semanal passa a falhar até ser configurado de novo).
-- Fica fora de migrations/ para nunca rodar por engano.

alter default privileges for role postgres in schema public revoke select on tables from backup_leitura;
alter default privileges for role postgres in schema public revoke select on sequences from backup_leitura;
drop owned by backup_leitura;
drop role backup_leitura;
