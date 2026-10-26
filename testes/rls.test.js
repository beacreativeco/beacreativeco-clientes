// Regras de acesso (RLS e funções) contra o banco de desenvolvimento, nunca o da produção.
// Só roda com o .dev.vars apontando para o projeto de dev do config.js; senão, fica pulado.
// Cria uma Bea, dois clientes (um suspenso à parte) e conteúdos de teste, e apaga tudo no fim.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pular, api, linhas, inserir, novoLogin as criarLogin, apagarLogin } from './banco-dev.js';

const marca = crypto.randomUUID().slice(0, 8);
const usuarios = [];
const novoLogin = async (nome) => {
  const login = await criarLogin(`rls-${nome}`);
  usuarios.push(login.id);
  return login;
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

  t.aAjuste = await conteudo(t.cliA, 'em_aprovacao');
  t.bRascunho = await conteudo(t.cliB, 'rascunho');
  const midia = (c) => inserir('midias', { conteudo_id: c.id, tipo: 'imagem', arquivo_url: `/api/midia/trabalho/${c.id}/${crypto.randomUUID()}.jpg` });
  t.midiaARascunho = await midia(t.aRascunho);
  t.midiaA = await midia(t.aAprovacao);
  t.midiaB = await midia(t.bAprovacao);

  // criado_em vem do servidor no INSERT; para testar o prazo, a chave de serviço volta o relógio depois.
  const mensagem = async (cliente, autor, texto, minutosAtras = 0) => {
    const m = await inserir('mensagens', { cliente_id: cliente.id, autor, tipo: 'texto', texto });
    if (minutosAtras) {
      await api(`/rest/v1/mensagens?id=eq.${m.id}`, { metodo: 'PATCH', corpo: { criado_em: new Date(Date.now() - minutosAtras * 60_000).toISOString() } });
    }
    return m;
  };
  t.msgB = await mensagem(t.cliB, 'cliente', 'do B');
  t.msgBea = await mensagem(t.cliA, 'bea', 'da Bea');
  t.msgS = await mensagem(t.cliS, 'cliente', 'do suspenso');
  t.msgAEditar = await mensagem(t.cliA, 'cliente', 'para editar');
  t.msgA16min = await mensagem(t.cliA, 'cliente', 'de 16 minutos', 16);
  t.msgA49h = await mensagem(t.cliA, 'cliente', 'de 49 horas', 49 * 60);

  t.aparelhoA = await inserir('push_aparelhos', { user_id: t.a.id, endpoint: `https://push.invalid/${crypto.randomUUID()}`, p256dh: 'x', auth: 'y' });
});

after(async () => {
  if (pular) return;
  for (const c of [t.cliA, t.cliB, t.cliS].filter(Boolean)) await api(`/rest/v1/clientes?id=eq.${c.id}`, { metodo: 'DELETE' });
  for (const id of usuarios) await apagarLogin(id);
});

const ids = (rows) => rows.map((r) => r.id);

test('sem login: nada de tabela nem função', { skip: pular }, async () => {
  for (const tabela of ['clientes', 'conteudos', 'conteudos_internos', 'mensagens', 'midias', 'admins', 'agencia', 'push_aparelhos']) {
    assert.deepEqual(await linhas(`${tabela}?select=*`, null), [], tabela);
  }
  const rpc = await api('/rest/v1/rpc/aprovar_conteudo', { metodo: 'POST', corpo: { p_conteudo_id: t.aAprovacao.id }, token: null });
  assert.notEqual(rpc.status, 200);
});

test('B não lê nada de A', { skip: pular }, async () => {
  const deA = [t.aRascunho, t.aAprovacao, t.aAprovar, t.aAjuste].map((c) => c.id);
  assert.deepEqual(await linhas(`clientes?select=id&id=eq.${t.cliA.id}`, t.b.token), []);
  assert.deepEqual(await linhas(`conteudos?select=id&cliente_id=eq.${t.cliA.id}`, t.b.token), []);
  assert.deepEqual(await linhas(`midias?select=id&conteudo_id=in.(${deA})`, t.b.token), []);
  assert.deepEqual(await linhas(`mensagens?select=id&cliente_id=eq.${t.cliA.id}`, t.b.token), []);
  assert.deepEqual(await linhas(`push_aparelhos?select=id&user_id=eq.${t.a.id}`, t.b.token), []);
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
  assert.deepEqual(await linhas('midias?select=id', t.suspenso.token), []);
  assert.deepEqual(await linhas('mensagens?select=id', t.suspenso.token), []);
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

const rpc = (funcao, corpo, token = t.a.token) => api(`/rest/v1/rpc/${funcao}`, { metodo: 'POST', corpo, token });
const editar = (m, token) => rpc('editar_mensagem', { p_mensagem_id: m.id, p_texto: 'mudei' }, token);
const apagar = (m, token) => rpc('apagar_mensagem', { p_mensagem_id: m.id }, token);
const mensagemAgora = async (m) => (await linhas(`mensagens?select=texto,apagada_em&id=eq.${m.id}`))[0];

test('pedir ajuste: só conteúdo próprio em aprovação', { skip: pular }, async () => {
  const pedir = (c, token) => rpc('pedir_ajuste', { p_conteudo_id: c.id, p_texto: 'muda a cor' }, token);
  assert.notEqual((await pedir(t.bAprovacao)).status, 200, 'de outro cliente');
  assert.notEqual((await pedir(t.aRascunho)).status, 200, 'rascunho');
  assert.notEqual((await pedir(t.sAprovacao, t.suspenso.token)).status, 200, 'suspenso');
  assert.notEqual((await pedir(t.aAjuste, null)).status, 200, 'sem login');
  for (const c of [t.bAprovacao, t.sAprovacao]) assert.equal((await linhas(`conteudos?select=status&id=eq.${c.id}`))[0].status, 'em_aprovacao');
  assert.equal((await linhas(`conteudos?select=status&id=eq.${t.aRascunho.id}`))[0].status, 'rascunho');

  const ok = await pedir(t.aAjuste);
  assert.equal(ok.status, 200, JSON.stringify(ok.dados));
  assert.equal(ok.dados.status, 'ajuste_solicitado');
  const [pedido] = await linhas(`mensagens?select=id&conteudo_id=eq.${t.aAjuste.id}&pedido_ajuste=is.true`);
  assert.notEqual((await editar(pedido)).status, 200, 'o pedido fica como registro');
  assert.notEqual((await apagar(pedido)).status, 200, 'o pedido fica como registro');
});

test('editar e apagar mensagem: só as próprias e dentro do prazo', { skip: pular }, async () => {
  assert.notEqual((await editar(t.msgB)).status, 200, 'A edita a do B');
  assert.notEqual((await apagar(t.msgB)).status, 200, 'A apaga a do B');
  assert.notEqual((await editar(t.msgBea)).status, 200, 'A edita a da Bea');
  assert.notEqual((await apagar(t.msgBea)).status, 200, 'A apaga a da Bea');
  assert.notEqual((await editar(t.msgAEditar, t.b.token)).status, 200, 'B edita a do A');
  assert.notEqual((await apagar(t.msgAEditar, t.b.token)).status, 200, 'B apaga a do A');
  assert.notEqual((await editar(t.msgAEditar, t.bea.token)).status, 200, 'a Bea edita a do cliente');
  assert.notEqual((await apagar(t.msgAEditar, t.bea.token)).status, 200, 'a Bea apaga a do cliente');
  assert.notEqual((await editar(t.msgS, t.suspenso.token)).status, 200, 'suspenso edita a própria');
  assert.notEqual((await apagar(t.msgS, t.suspenso.token)).status, 200, 'suspenso apaga a própria');
  assert.notEqual((await editar(t.msgAEditar, t.suspenso.token)).status, 200, 'suspenso edita a do A');
  assert.notEqual((await apagar(t.msgAEditar, t.suspenso.token)).status, 200, 'suspenso apaga a do A');
  assert.notEqual((await editar(t.msgAEditar, null)).status, 200, 'sem login');
  assert.notEqual((await editar(t.msgA16min)).status, 200, 'editar depois de 15 minutos');
  assert.notEqual((await apagar(t.msgA49h)).status, 200, 'apagar depois de 48 horas');

  assert.deepEqual(await mensagemAgora(t.msgB), { texto: 'do B', apagada_em: null });
  assert.deepEqual(await mensagemAgora(t.msgBea), { texto: 'da Bea', apagada_em: null });
  assert.deepEqual(await mensagemAgora(t.msgS), { texto: 'do suspenso', apagada_em: null });
  assert.deepEqual(await mensagemAgora(t.msgA16min), { texto: 'de 16 minutos', apagada_em: null });
  assert.deepEqual(await mensagemAgora(t.msgA49h), { texto: 'de 49 horas', apagada_em: null });

  // Controle: dentro do prazo, a dona consegue (então as recusas acima são da regra, não do teste).
  assert.equal((await mensagemAgora(t.msgAEditar)).texto, 'para editar');
  assert.equal((await editar(t.msgAEditar)).status, 200);
  assert.equal((await mensagemAgora(t.msgAEditar)).texto, 'mudei');
  assert.equal((await apagar(t.msgA16min)).status, 200, 'apagar com 16 minutos ainda pode');
  assert.ok((await mensagemAgora(t.msgA16min)).apagada_em);
});

test('marcar a conversa como lida: só a própria', { skip: pular }, async () => {
  const marcar = (token) => rpc('marcar_conversa_do_cliente_lida', { p_cliente_id: t.cliA.id }, token);
  // Função sem retorno: deu certo é 204, então a recusa é conferida pelo erro (4xx).
  assert.ok((await marcar(t.b.token)).status >= 400, 'B na conversa do A');
  assert.ok((await marcar(t.suspenso.token)).status >= 400, 'suspenso na conversa do A');
  assert.ok((await marcar(null)).status >= 400, 'sem login');
  assert.ok([200, 204].includes((await marcar(t.a.token)).status), 'o próprio A');
});

test('mídias: só dos próprios conteúdos fora de rascunho, e só a Bea grava', { skip: pular }, async () => {
  const todas = [t.midiaARascunho, t.midiaA, t.midiaB].map((m) => m.id);
  assert.deepEqual(ids(await linhas(`midias?select=id&id=in.(${todas})`, t.a.token)), [t.midiaA.id]);
  assert.deepEqual(ids(await linhas(`midias?select=id&id=in.(${todas})`, t.b.token)), [t.midiaB.id]);
  assert.equal((await linhas(`midias?select=id&id=in.(${todas})`, t.bea.token)).length, 3);

  const nova = await api('/rest/v1/midias', {
    metodo: 'POST', token: t.a.token,
    corpo: { conteudo_id: t.aAprovacao.id, tipo: 'imagem', arquivo_url: `/api/midia/trabalho/${t.aAprovacao.id}/x.jpg` },
  });
  assert.notEqual(nova.status, 201);
  await api(`/rest/v1/midias?id=eq.${t.midiaB.id}`, { metodo: 'PATCH', corpo: { arquivo_url: '/api/midia/trocada.jpg' }, token: t.a.token });
  await api(`/rest/v1/midias?id=eq.${t.midiaA.id}`, { metodo: 'DELETE', token: t.a.token });
  assert.equal((await linhas(`midias?select=arquivo_url&id=eq.${t.midiaB.id}`))[0].arquivo_url, t.midiaB.arquivo_url);
  assert.equal((await linhas(`midias?select=id&id=eq.${t.midiaA.id}`)).length, 1);
});

test('aparelhos do push: cada um só os seus', { skip: pular }, async () => {
  assert.deepEqual(ids(await linhas('push_aparelhos?select=id', t.a.token)), [t.aparelhoA.id]);
  for (const quem of [t.b, t.suspenso, t.bea]) {
    assert.deepEqual(await linhas(`push_aparelhos?select=id&id=eq.${t.aparelhoA.id}`, quem.token), []);
    await api(`/rest/v1/push_aparelhos?id=eq.${t.aparelhoA.id}`, { metodo: 'DELETE', token: quem.token });
  }
  const direto = await api('/rest/v1/push_aparelhos', {
    metodo: 'POST', token: t.b.token,
    corpo: { user_id: t.a.id, endpoint: `https://push.invalid/${crypto.randomUUID()}`, p256dh: 'x', auth: 'y' },
  });
  assert.notEqual(direto.status, 201, 'inserir direto, em nome de outro');
  assert.equal((await linhas(`push_aparelhos?select=id&id=eq.${t.aparelhoA.id}`)).length, 1);
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
