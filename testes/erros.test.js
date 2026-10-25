// O que vai para o Sentry: nada que identifique cliente ou mensagem (public/assets/js/erros.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpar, prepararEvento, prepararRegistro } from '../public/assets/js/erros.js';

const ID = '6a44eee3-906e-4d89-8adb-19bd47dae953';

test('ids, e-mails, tokens e query das URLs saem', () => {
  assert.equal(limpar(`https://clientes.beacreativeco.com.br/admin/conteudo/?id=${ID}&aba=conversa`),
    'https://clientes.beacreativeco.com.br/admin/conteudo/');
  assert.equal(limpar(`/cliente/conteudo/?id=${ID}`), '/cliente/conteudo/');
  assert.equal(limpar(`GET /api/midia/trabalho/${ID}/${ID}.jpg 404`), 'GET /api/midia/trabalho/<id>/<id>.jpg 404');
  assert.equal(limpar('Falha para bea.creative+teste@gmail.com'), 'Falha para <email>');
  assert.equal(limpar('Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3OCJ9.abc'), 'Bearer <token>');
  assert.equal(limpar(`fetch(${'https://dudxbbqyofzetuvpuzrh.supabase.co/rest/v1/mensagens?cliente_id=eq.'}${ID})`),
    'fetch(https://dudxbbqyofzetuvpuzrh.supabase.co/rest/v1/mensagens)');
  assert.equal(limpar('TypeError: x is not a function'), 'TypeError: x is not a function');
});

test('evento: sem usuário, sem cookies, só o navegador nos cabeçalhos, tudo limpo por dentro', () => {
  const evento = prepararEvento({
    user: { email: 'a@b.com', ip_address: '1.2.3.4' },
    request: {
      url: `https://dev.beacreativeco-clientes.pages.dev/admin/mensagens/?cliente=${ID}`,
      cookies: { sb: 'x' },
      headers: { 'User-Agent': 'Chrome', Referer: `https://x/?cliente=${ID}` },
    },
    exception: { values: [{ value: `Conteúdo ${ID} não encontrado`, stacktrace: { frames: [{ filename: '/assets/js/conversa.js?v=1' }] } }] },
  });
  assert.equal(evento.user, undefined);
  assert.equal(evento.request.cookies, undefined);
  assert.deepEqual(evento.request.headers, { 'User-Agent': 'Chrome' });
  assert.equal(evento.request.url, 'https://dev.beacreativeco-clientes.pages.dev/admin/mensagens/');
  assert.equal(evento.exception.values[0].value, 'Conteúdo <id> não encontrado');
  assert.equal(evento.exception.values[0].stacktrace.frames[0].filename, '/assets/js/conversa.js');
});

test('registros: console e cliques nunca; navegação e rede, limpos', () => {
  assert.equal(prepararRegistro({ category: 'console', message: 'texto da mensagem do cliente' }), null);
  assert.equal(prepararRegistro({ category: 'ui.click', message: 'div.conversa-balao' }), null);
  assert.equal(prepararRegistro({ category: 'ui.input' }), null);
  assert.deepEqual(prepararRegistro({ category: 'navigation', data: { from: `/cliente/conteudo/?id=${ID}`, to: '/cliente/' } }),
    { category: 'navigation', data: { from: '/cliente/conteudo/', to: '/cliente/' } });
  assert.deepEqual(prepararRegistro({ category: 'fetch', data: { url: `/api/conversa/arquivo?cliente_id=${ID}`, status_code: 413 } }),
    { category: 'fetch', data: { url: '/api/conversa/arquivo', status_code: 413 } });
});
