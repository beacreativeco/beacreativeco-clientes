// Regras de acesso (RLS e funções) contra o banco de desenvolvimento, nunca o da produção.
// Só roda com o .dev.vars apontando para o projeto de dev do config.js; senão, fica pulado.
// Cria uma Bea, dois clientes (um suspenso à parte) e conteúdos de teste, e apaga tudo no fim.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cabecalhosServidor } from '../functions/_lib/servidor.js';

const lerVars = () => { try { return readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8'); } catch { return ''; } };
const vars = Object.fromEntries(lerVars()
  .split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const config = readFileSync(new URL('../public/assets/js/config.js', import.meta.url), 'utf8');
const URL_DEV = config.match(/SUPABASE_URL = DEV \? '([^']+)'/)[1];
const PUBLICA = config.match(/SUPABASE_ANON_KEY = DEV \? '([^']+)'/)[1];
const pular = vars.SUPABASE_URL?.replace(/\/+$/, '') !== URL_DEV
  && 'o .dev.vars não aponta para o banco de desenvolvimento';

const SERVICO = cabecalhosServidor({ SUPABASE_SERVICE_ROLE_KEY: vars.SUPABASE_SERVICE_ROLE_KEY ?? '' });
const SENHA = `Rls-${crypto.randomUUID()}`;
const marca = crypto.randomUUID().slice(0, 8);

// token: null = anon (só a chave publishable); 'servico' = chave secreta; texto = login.
async function api(caminho, { metodo = 'GET', corpo, token = 'servico' } = {}) {
  const headers = token === 'servico' ? { ...SERVICO } : { apikey: PUBLICA, ...(token && { Authorization: `Bearer ${token}` }) };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  headers.Prefer = 'return=representation';
  const resp = await fetch(`${URL_DEV}${caminho}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const dados = await resp.json().catch(() => null);
  return { status: resp.status, dados };
}
const linhas = async (caminho, token) => {
  const r = await api(`/rest/v1/${caminho}`, { token });
  return r.status === 200 ? r.dados : [];
};

const usuarios = [];
async function novoLogin(nome) {
  const email = `rls-${marca}-${nome}@teste.invalid`;
  const { dados } = await api('/auth/v1/admin/users', { metodo: 'POST', corpo: { email, password: SENHA, email_confirm: true } });
  assert.ok(dados?.id, `criar login ${nome}: ${JSON.stringify(dados)}`);
  usuarios.push(dados.id);
  const login = await api('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email, password: SENHA }, token: null });
  assert.ok(login.dados?.access_token, `entrar como ${nome}`);
  return { id: dados.id, token: login.dados.access_token };
}
const inserir = async (tabela, corpo) => {
  const r = await api(`/rest/v1/${tabela}`, { metodo: 'POST', corpo });
  assert.equal(r.status, 201, `inserir em ${tabela}: ${JSON.stringify(r.dados)}`);
  return r.dados[0];
};

const t = {};
before(async () => {
  if (pular) return;
  t.bea = await novoLogin('bea');
  await inserir('admins', { user_id: t.bea.id });
  t.a = await novoLogin('a');
  t.b = await novoLogin('b');
  t.suspenso = await novoLogin('suspenso');
  t.cliA = await inserir('clientes', { nome: `RLS A ${marca}`, slug: `rls-a-${marca}`, user_id: t.a.id });
  t.cliB = await inserir('clientes', { nome: `RLS B ${marca}`, slug: `rls-b-${marca}`, user_id: t.b.id });
  t.cliS = await inserir('clientes', { nome: `RLS S ${marca}`, slug: `rls-s-${marca}`, user_id: t.suspenso.id, login_ativo: false });
  const conteudo = (cliente, status) => inserir('conteudos', { cliente_id: cliente.id, titulo: `RLS ${status}`, formato: 'post', status });
  t.aRascunho = await conteudo(t.cliA, 'rascunho');
  t.aAprovacao = await conteudo(t.cliA, 'em_aprovacao');
  t.aAprovar = await conteudo(t.cliA, 'em_aprovacao');
  t.bAprovacao = await conteudo(t.cliB, 'em_aprovacao');
  t.sAprovacao = await conteudo(t.cliS, 'em_aprovacao');
  await inserir('conteudos_internos', { conteudo_id: t.aAprovacao.id, observacao_interna: 'segredo' });
  t.msgSoBea = await inserir('mensagens', { conteudo_id: t.aRascunho.id, autor: 'bea', tipo: 'texto', texto: 'nota no rascunho' });
  t.msgA = await inserir('mensagens', { cliente_id: t.cliA.id, autor: 'cliente', tipo: 'texto', texto: 'oi' });
});

after(async () => {
  if (pular) return;
  for (const c of [t.cliA, t.cliB, t.cliS].filter(Boolean)) await api(`/rest/v1/clientes?id=eq.${c.id}`, { metodo: 'DELETE' });
  for (const id of usuarios) await api(`/auth/v1/admin/users/${id}`, { metodo: 'DELETE' });
});

const ids = (rows) => rows.map((r) => r.id);

test('sem login: nada de tabela nem função', { skip: pular }, async () => {
  for (const tabela of ['clientes', 'conteudos', 'conteudos_internos', 'mensagens', 'midias', 'admins', 'agencia']) {
    assert.deepEqual(await linhas(`${tabela}?select=*`, null), [], tabela);
  }
  const rpc = await api('/rest/v1/rpc/aprovar_conteudo', { metodo: 'POST', corpo: { p_conteudo_id: t.aAprovacao.id }, token: null });
  assert.notEqual(rpc.status, 200);
});

test('cliente vê só os próprios conteúdos fora de rascunho', { skip: pular }, async () => {
  const vistos = ids(await linhas(`conteudos?select=id&id=in.(${[t.aRascunho, t.aAprovacao, t.bAprovacao].map((c) => c.id)})`, t.a.token));
  assert.deepEqual(vistos, [t.aAprovacao.id]);
  assert.deepEqual(ids(await linhas('clientes?select=id', t.a.token)), [t.cliA.id]);
  assert.deepEqual(await linhas('conteudos_internos?select=*', t.a.token), []);
  assert.deepEqual(await linhas('admins?select=*', t.a.token), []);
});

test('cliente suspenso não vê nada', { skip: pular }, async () => {
  assert.deepEqual(await linhas('clientes?select=id', t.suspenso.token), []);
  assert.deepEqual(await linhas('conteudos?select=id', t.suspenso.token), []);
  const rpc = await api('/rest/v1/rpc/aprovar_conteudo', { metodo: 'POST', corpo: { p_conteudo_id: t.sAprovacao.id }, token: t.suspenso.token });
  assert.notEqual(rpc.status, 200);
});

test('cliente não cria nem edita cliente ou conteúdo', { skip: pular }, async () => {
  const novo = await api('/rest/v1/conteudos', { metodo: 'POST', corpo: { cliente_id: t.cliA.id, titulo: 'invasão', formato: 'post' }, token: t.a.token });
  assert.notEqual(novo.status, 201);
  await api(`/rest/v1/conteudos?id=eq.${t.aAprovacao.id}`, { metodo: 'PATCH', corpo: { status: 'aprovado' }, token: t.a.token });
  await api(`/rest/v1/clientes?id=eq.${t.cliA.id}`, { metodo: 'PATCH', corpo: { login_ativo: true, nome: 'mudei' }, token: t.a.token });
  await api(`/rest/v1/conteudos?id=eq.${t.aAprovacao.id}`, { metodo: 'DELETE', token: t.a.token });
  const [c] = await linhas(`conteudos?select=status&id=eq.${t.aAprovacao.id}`);
  assert.equal(c?.status, 'em_aprovacao');
  const [cli] = await linhas(`clientes?select=nome&id=eq.${t.cliA.id}`);
  assert.equal(cli.nome, t.cliA.nome);
});

test('aprovar: só conteúdo próprio em aprovação', { skip: pular }, async () => {
  const aprovar = (conteudo) => api('/rest/v1/rpc/aprovar_conteudo', { metodo: 'POST', corpo: { p_conteudo_id: conteudo.id }, token: t.a.token });
  assert.notEqual((await aprovar(t.bAprovacao)).status, 200, 'de outro cliente');
  assert.notEqual((await aprovar(t.aRascunho)).status, 200, 'rascunho');
  const ok = await aprovar(t.aAprovar);
  assert.equal(ok.status, 200, JSON.stringify(ok.dados));
  assert.equal(ok.dados.aprovado_por, 'cliente');
  const [b] = await linhas(`conteudos?select=status&id=eq.${t.bAprovacao.id}`);
  assert.equal(b.status, 'em_aprovacao');
});

test('conversa: cliente só na própria, como cliente, sem ver o que é só da Bea', { skip: pular }, async () => {
  const vistas = ids(await linhas('mensagens?select=id', t.a.token));
  assert.ok(vistas.includes(t.msgA.id));
  assert.ok(!vistas.includes(t.msgSoBea.id), 'mensagem só da Bea');
  assert.deepEqual(await linhas(`mensagens?select=id&cliente_id=eq.${t.cliA.id}`, t.b.token), []);

  const enviar = (corpo) => api('/rest/v1/mensagens', { metodo: 'POST', corpo: { tipo: 'texto', texto: 'x', autor: 'cliente', ...corpo }, token: t.a.token });
  assert.equal((await enviar({ cliente_id: t.cliA.id })).status, 201, 'na própria conversa');
  assert.notEqual((await enviar({ cliente_id: t.cliB.id })).status, 201, 'na conversa de outro');
  assert.notEqual((await enviar({ conteudo_id: t.bAprovacao.id })).status, 201, 'com conteúdo de outro');
  assert.notEqual((await enviar({ conteudo_id: t.aRascunho.id })).status, 201, 'com rascunho');
  assert.notEqual((await enviar({ cliente_id: t.cliA.id, autor: 'bea' })).status, 201, 'como a Bea');
  assert.notEqual((await enviar({ cliente_id: t.cliA.id, pedido_ajuste: true })).status, 201, 'pedido de ajuste direto');
  assert.notEqual((await enviar({ cliente_id: t.cliA.id, tipo: 'aprovacao' })).status, 201, 'aprovação direta');

  await api(`/rest/v1/mensagens?id=eq.${t.msgA.id}`, { metodo: 'PATCH', corpo: { texto: 'editada direto' }, token: t.a.token });
  await api(`/rest/v1/mensagens?id=eq.${t.msgA.id}`, { metodo: 'DELETE', token: t.a.token });
  const [m] = await linhas(`mensagens?select=texto&id=eq.${t.msgA.id}`);
  assert.equal(m?.texto, 'oi');
});

test('tabelas do push fechadas para quem está logado', { skip: pular }, async () => {
  for (const tabela of ['push_destinos', 'push_eventos']) {
    assert.deepEqual(await linhas(`${tabela}?select=*`, t.bea.token), [], tabela);
  }
});

test('a Bea vê tudo', { skip: pular }, async () => {
  const vistos = ids(await linhas(`conteudos?select=id&id=in.(${[t.aRascunho, t.aAprovacao, t.bAprovacao].map((c) => c.id)})`, t.bea.token));
  assert.equal(vistos.length, 3);
  assert.equal((await linhas(`conteudos_internos?select=observacao_interna&conteudo_id=eq.${t.aAprovacao.id}`, t.bea.token))[0]?.observacao_interna, 'segredo');
  assert.ok(ids(await linhas('mensagens?select=id', t.bea.token)).includes(t.msgSoBea.id));
});
