-- Desfaz supabase/migrations/20261024000000_anon_sem_acesso.sql: devolve ao anon e ao PUBLIC
-- o acesso de antes. Fica fora de migrations/ para nunca rodar por engano.
-- Os grants ao authenticated do passo 1 não são desfeitos: todas já tinham antes.

-- Passo 2: funções de gatilho voltam a PUBLIC, anon e authenticated (padrão do Supabase).
grant execute on function public.tocar_atualizado_em()     to public, anon, authenticated;
grant execute on function public.mensagens_preencher()     to public, anon, authenticated;
grant execute on function public.push_mensagem_nova()      to public, anon, authenticated;
grant execute on function public.push_conteudo_liberado()  to public, anon, authenticated;

-- Passo 3: tabelas e sequências como o Supabase cria (ALL para o anon),
-- menos push_destinos e push_eventos, que nunca tiveram (migração 20261021000000).
grant all on all tables    in schema public to anon;
grant all on all sequences in schema public to anon;
revoke all on public.push_destinos from anon;
revoke all on public.push_eventos  from anon;

-- Passo 4: permissões padrão do Supabase para objetos novos.
alter default privileges for role postgres in schema public grant all on tables    to anon;
alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant all on functions to anon;
