// Criptografia do Web Push conferida contra o exemplo oficial (RFC 8291, seção 5 e apêndice A).
// Se cifrar() mudar e o resultado não bater, nenhum aparelho consegue abrir os avisos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, deBase64url, paraBase64url } from '../functions/_lib/webpush.js';

const RFC = {
  texto: 'When I grow up, I want to be a watermelon',
  servidor: {
    publica: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    privada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  },
  aparelho: {
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  },
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  cabecalho: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  cifrado: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
};

test('cifrar() dá exatamente o resultado do exemplo da RFC 8291', async () => {
  const saida = await cifrar(RFC.texto, RFC.aparelho, { servidor: RFC.servidor, salt: deBase64url(RFC.salt) });
  assert.equal(saida.length, 86 + deBase64url(RFC.cifrado).length);
  assert.equal(paraBase64url(saida.slice(0, 86)), RFC.cabecalho);
  assert.equal(paraBase64url(saida.slice(86)), RFC.cifrado);
});

test('base64url vai e volta (com e sem preenchimento, com espaços)', () => {
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(deBase64url(paraBase64url(bytes)), bytes);
  assert.equal(paraBase64url(new Uint8Array([0xfb, 0xff])), '-_8');
  assert.deepEqual(deBase64url('-_8'), new Uint8Array([0xfb, 0xff]));
  assert.deepEqual(deBase64url(' -_ 8 '), new Uint8Array([0xfb, 0xff]));
});
