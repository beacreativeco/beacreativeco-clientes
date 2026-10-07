-- =============================================================
-- Notificações push, entrega 2: o banco avisa o servidor quando algo acontece.
-- Mensagem nova (inclui aprovação e pedido de ajuste) e conteúdo liberado para aprovação
-- chamam POST /api/push/evento com { tipo, id }. Quem decide quem avisar e o texto é o
-- servidor, que relê a linha no banco (nunca confia no corpo da chamada).
--
-- pg_net manda a chamada depois do commit, sem travar quem gravou a mensagem.
-- =============================================================

create extension if not exists pg_net;

-- Para onde mandar e com qual segredo (cabeçalho X-Push-Segredo). Preenchida pelo
-- servidor/admin com a chave de serviço (fora do Git). Sem policy e sem permissão para
-- anon/authenticated: ninguém do site lê. Produção avisa todos; o Preview só os clientes
-- de teste (regra no servidor, functions/api/push/evento.js).
create table public.push_destinos (
  url     text primary key check (url like 'https://%'),
  segredo text not null,
  ativo   boolean not null default true,
  nota    text
);
alter table public.push_destinos enable row level security;
revoke all on public.push_destinos from anon, authenticated;

-- Cada aviso sai uma vez só, mesmo com dois destinos (produção e Preview) ou chamadas
-- repetidas: quem gravar a chave primeiro envia.
-- Chaves: 'mensagem:<id>', 'liberado:<conteudo>:<versão>', 'prazo:<conteudo>:<prazo>'.
create table public.push_eventos (
  chave     text primary key,
  criado_em timestamptz not null default now()
);
alter table public.push_eventos enable row level security;
revoke all on public.push_eventos from anon, authenticated;

-- Chama os destinos ativos. Nunca impede a gravação: erro aqui vira só um aviso no log.
create or replace function public.push_avisar(p_evento jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
begin
  for d in select url, segredo from public.push_destinos where ativo loop
    perform net.http_post(
      url := d.url,
      body := p_evento,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Push-Segredo', d.segredo),
      timeout_milliseconds := 10000
    );
  end loop;
exception when others then
  raise warning 'push_avisar: %', sqlerrm;
end;
$$;

create or replace function public.push_mensagem_nova()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.push_avisar(jsonb_build_object('tipo', 'mensagem', 'id', new.id));
  return null;
end;
$$;

-- Escritas só para a Bea (num rascunho) nunca viram aviso.
create trigger push_mensagem_nova
  after insert on public.mensagens
  for each row when (not new.so_bea)
  execute function public.push_mensagem_nova();

create or replace function public.push_conteudo_liberado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.push_avisar(jsonb_build_object('tipo', 'conteudo_liberado', 'id', new.id));
  return null;
end;
$$;

-- Conteúdo novo ou nova versão chegando para o cliente aprovar.
create trigger push_conteudo_liberado
  after update of status on public.conteudos
  for each row when (new.status = 'em_aprovacao' and old.status is distinct from 'em_aprovacao')
  execute function public.push_conteudo_liberado();

revoke execute on function public.push_avisar(jsonb) from public, anon, authenticated;
