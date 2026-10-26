-- =============================================================
-- Usuário só de leitura para o backup semanal (repositório privado beacreativeco-backup).
-- O pg_dump entra com ele em vez do postgres: lê public e auth, não escreve nada.
--
-- Sem senha aqui (o repositório é tratado como público): a senha é definida à mão no
-- SQL Editor, em cada banco, com
--   alter role backup_leitura password '<senha gerada, fora do Git>';
-- Sem essa linha, ninguém entra com ele.
--
-- bypassrls: o pg_dump desliga o RLS e para com erro numa tabela com RLS se o usuário não
-- puder ignorá-lo (ou faria um backup incompleto, só com as linhas visíveis).
-- =============================================================

create role backup_leitura login bypassrls;

grant usage on schema public, auth to backup_leitura;
grant select on all tables in schema public, auth to backup_leitura;
grant select on all sequences in schema public, auth to backup_leitura;

-- Tabelas que as próximas migrações criarem (pelo postgres) já nascem legíveis pelo backup.
-- As do auth são criadas pelo próprio Supabase: tabela nova lá faz o backup falhar, e aí é
-- só repetir o grant acima.
alter default privileges for role postgres in schema public grant select on tables to backup_leitura;
alter default privileges for role postgres in schema public grant select on sequences to backup_leitura;
