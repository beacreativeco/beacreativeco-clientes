// Leitura dos cartões do Trello (título → data, formato e título) e o webhook
// (assinatura de quem chama e quais mudanças sincronizam).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { lerTitulo, ehSeparador, etapasDoCartao } from '../functions/_lib/trello.js';
import { assinaturaValida, acaoInteressa } from '../functions/_lib/trello-webhook.js';

const OUTUBRO = new Date(2026, 9, 1);

test('título no padrão combinado', () => {
  assert.deepEqual(lerTitulo('05 · ter 13/10 · Reels · O verão da pele começa agora', OUTUBRO), {
    data: '2026-10-13', formato: 'reels', titulo: 'O verão da pele começa agora', avisos: [], entrega: true,
  });
  const c = lerTitulo('carrossel 3 | 13/10/25 | Dicas de cuidado', OUTUBRO);
  assert.equal(c.data, '2025-10-13');
  assert.equal(c.formato, 'carrossel');
  assert.equal(c.titulo, 'Dicas de cuidado');
});

test('título sem data ou sem nada: aviso e fora das entregas', () => {
  const semData = lerTitulo('Reels - FisioFort', OUTUBRO);
  assert.equal(semData.data, null);
  assert.equal(semData.formato, 'reels');
  assert.equal(semData.titulo, 'FisioFort');
  assert.deepEqual(semData.avisos, ['sem data no título do Trello']);
  assert.equal(semData.entrega, true);

  const nada = lerTitulo('Roteiros Stories', OUTUBRO);
  assert.equal(nada.entrega, false);
  assert.equal(nada.formato, 'post');
  assert.equal(nada.titulo, 'Roteiros Stories');
});

test('data sem ano: o ano mais perto de hoje', () => {
  assert.equal(lerTitulo('02/01 · Post · Ano novo', new Date(2026, 11, 20)).data, '2027-01-02');
  assert.equal(lerTitulo('20/12 · Post · Natal', new Date(2027, 0, 5)).data, '2026-12-20');
  assert.equal(lerTitulo('31/13 · Post · Data impossível', OUTUBRO).data, null);
});

test('separadores de semana e etapas pelas etiquetas', () => {
  assert.ok(ehSeparador('.'));
  assert.ok(ehSeparador('​​'));
  assert.ok(ehSeparador(''));
  assert.ok(!ehSeparador('Título'));
  assert.deepEqual(etapasDoCartao([{ name: 'aprovado' }, { name: ' GRAVAR ' }, { name: 'outra' }, {}]), ['GRAVAR', 'APROVADO']);
});

test('webhook: só aceita a assinatura do Trello para este corpo e este endereço', async () => {
  // Segredo sorteado a cada execução: nenhum valor fixo no código (o hook de segredos barra).
  const env = { TRELLO_API_SECRET: randomUUID(), SITE_URL: 'https://clientes.beacreativeco.com.br/' };
  const corpo = JSON.stringify({ action: { type: 'updateCard', data: { card: { name: 'Coleção de verão ✦' } } } });
  const assinar = (texto) => createHmac('sha1', env.TRELLO_API_SECRET)
    .update(texto + 'https://clientes.beacreativeco.com.br/api/trello/webhook').digest('base64');

  assert.equal(await assinaturaValida(env, corpo, assinar(corpo)), true);
  assert.equal(await assinaturaValida(env, `${corpo} `, assinar(corpo)), false);
  assert.equal(await assinaturaValida(env, corpo, assinar(corpo).slice(1)), false);
  assert.equal(await assinaturaValida(env, corpo, null), false);
  assert.equal(await assinaturaValida({ ...env, TRELLO_API_SECRET: 'outro' }, corpo, assinar(corpo)), false);
});

test('webhook: só mudanças que importam sincronizam', () => {
  assert.equal(acaoInteressa({ type: 'createCard' }), true);
  assert.equal(acaoInteressa({ type: 'updateCard', data: { old: { name: 'antes' } } }), true);
  assert.equal(acaoInteressa({ type: 'updateCard', data: { old: { idList: 'x' } } }), true);
  assert.equal(acaoInteressa({ type: 'updateCard', data: { old: { desc: 'antes' } } }), false);
  assert.equal(acaoInteressa({ type: 'updateCard', data: { old: { pos: 1 } } }), false);
  assert.equal(acaoInteressa({ type: 'commentCard' }), false);
  assert.equal(acaoInteressa(null), false);
});
