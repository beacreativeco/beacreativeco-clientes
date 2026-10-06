-- Armazenamento (item 5 do roadmap): pastas no R2 e exclusão automática.
-- Os arquivos ficam em trabalho/, aprovados/ ou vitrine/ (prefixos no bucket). Ao aprovar,
-- /api/conteudo/organizar move os arquivos para aprovados/, e a regra do R2 (Lifecycle) apaga
-- 30 dias depois. Aqui fica a data em que cada arquivo deixa de existir, para a tela mostrar
-- "Arquivo expirado, veja no Drive" sem tentar carregar, e o tamanho dos arquivos da conversa,
-- para o painel somar o espaço usado.

alter table public.midias
  add column expira_em timestamptz;           -- null: não expira (trabalho/ ou vitrine/)

alter table public.mensagens
  add column arquivo_mb        numeric(10, 2), -- tamanho do áudio ou da imagem da conversa
  add column arquivo_expira_em timestamptz;

-- Espaço usado no R2, em MB (aproximado: soma do que o banco sabe e ainda não expirou). Só a admin.
create or replace function public.espaco_usado()
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Só a admin pode ver o espaço usado.' using errcode = '42501';
  end if;
  return coalesce((
    select sum(tamanho_mb) from public.midias
     where expira_em is null or expira_em > now()
  ), 0) + coalesce((
    select sum(arquivo_mb) from public.mensagens
     where arquivo_url is not null and (arquivo_expira_em is null or arquivo_expira_em > now())
  ), 0);
end;
$$;

revoke execute on function public.espaco_usado() from public, anon;
grant  execute on function public.espaco_usado() to authenticated;
