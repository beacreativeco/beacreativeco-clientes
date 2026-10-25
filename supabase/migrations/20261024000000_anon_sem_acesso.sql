-- =============================================================
-- Quem não está logado (anon) não tem permissão em nada do schema public.
-- Até aqui só o RLS segurava (o Supabase dá ALL ao anon em toda tabela nova); agora,
-- uma policy futura escrita sem "to authenticated" não abre nada para quem não entrou.
-- Desfazer: supabase/desfazer/20261024000000_anon_sem_acesso.sql
-- =============================================================

-- 1) O que o site chama, com login, segue com o authenticated (explícito; todas já tinham).
grant execute on function public.aprovar_conteudo(uuid)                                       to authenticated;
grant execute on function public.pedir_ajuste(uuid, text, text, text, numeric, smallint[])    to authenticated;
grant execute on function public.editar_mensagem(uuid, text)                                  to authenticated;
grant execute on function public.apagar_mensagem(uuid)                                        to authenticated;
grant execute on function public.marcar_conversa_lida(uuid)                                   to authenticated;
grant execute on function public.marcar_conversa_do_cliente_lida(uuid)                        to authenticated;
grant execute on function public.conversas_nao_lidas()                                        to authenticated;
grant execute on function public.conversas_por_cliente()                                      to authenticated;
grant execute on function public.espaco_usado()                                               to authenticated;
grant execute on function public.perfil_bea()                                                 to authenticated;
grant execute on function public.salvar_meu_nome(text)                                        to authenticated;
grant execute on function public.registrar_aparelho(text, text, text, text)                   to authenticated;
-- Helpers das policies: o RLS roda com o papel de quem consulta, então o authenticated precisa.
grant execute on function public.is_admin()                                                   to authenticated;
grant execute on function public.meu_cliente_id()                                             to authenticated;
grant execute on function public.cliente_ve_conteudo(uuid)                                    to authenticated;
grant execute on function public.mensagem_valida(uuid, uuid, text, text, text)                to authenticated;

-- 2) Funções de gatilho: as únicas que ainda tinham EXECUTE para PUBLIC. Gatilho não confere
-- EXECUTE ao disparar (só ao ser criado), então ninguém além do dono precisa.
revoke execute on function public.tocar_atualizado_em()     from public, anon, authenticated;
revoke execute on function public.mensagens_preencher()     from public, anon, authenticated;
revoke execute on function public.push_mensagem_nova()      from public, anon, authenticated;
revoke execute on function public.push_conteudo_liberado()  from public, anon, authenticated;

-- 3) Nada para o anon no que já existe.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- 4) Nem no que for criado depois (objetos criados pelo postgres, que é quem roda as migrações).
-- O EXECUTE de PUBLIC em função nova é padrão do Postgres e não sai por schema: cada função
-- nova continua levando "revoke execute ... from public, anon" na própria migração.
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
