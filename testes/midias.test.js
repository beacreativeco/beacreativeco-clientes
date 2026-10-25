// Chaves de arquivo no R2: o /api/midia entrega sem login qualquer chave que passe nestas
// regras, então elas são a barreira (nada fora das pastas, nada com "..").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE, CHAVE_CONVERSA, CHAVE_CONVERSA_CLIENTE, CHAVE_PERFIL,
  conteudoDaChave, pastaDaChave, pastaDoConteudo, chaveNaPasta, expiraEm,
  tipoDaChave, urlDaChave, chaveDaUrl,
} from '../functions/_lib/midias.js';

const A = '0b6f1f3e-5c2d-4a7b-9e8f-1a2b3c4d5e6f';
const B = 'c9d8e7f6-a5b4-4c3d-8e2f-1a0b9c8d7e6f';
const TODAS = [CHAVE, CHAVE_CONVERSA, CHAVE_CONVERSA_CLIENTE, CHAVE_PERFIL];

test('chave de mídia: com e sem pasta', () => {
  for (const ok of [`${A}/${B}.jpg`, `trabalho/${A}/${B}.mp4`, `aprovados/${A}/${B}.webp`, `vitrine/${A}/${B}.mov`]) {
    assert.ok(CHAVE.test(ok), ok);
  }
  for (const nao of [`outra/${A}/${B}.jpg`, `${A}/${B}.exe`, `${A}/${B}`, `${A}/conversa/${B}.jpg`, `trabalho/${A}/x.jpg`]) {
    assert.ok(!CHAVE.test(nao), nao);
  }
});

test('nenhuma regra aceita sair da pasta ou chave montada à mão', () => {
  const tentativas = [
    `../${A}/${B}.jpg`, `trabalho/../${A}/${B}.jpg`, `${A}/../${B}.jpg`, `/${A}/${B}.jpg`,
    `conversa/${A}/../${B}.jpg`, `perfil/../${B}.jpg`, `${A}/${B}.jpg/`, `${A}/${B}.jpg?x=1`,
    `${A.toUpperCase()}/${B}.jpg`, `trabalho//${A}/${B}.jpg`, '',
  ];
  for (const chave of tentativas) assert.ok(TODAS.every((r) => !r.test(chave)), chave);
});

test('conversa: do conteúdo, do cliente e foto de perfil', () => {
  assert.ok(CHAVE_CONVERSA.test(`vitrine/${A}/conversa/${B}.webm`));
  assert.ok(CHAVE_CONVERSA.test(`${A}/conversa/${B}.m4a`));
  assert.ok(!CHAVE_CONVERSA.test(`${A}/conversa/${B}.png`));
  assert.ok(CHAVE_CONVERSA_CLIENTE.test(`conversa/${A}/${B}.jpg`));
  assert.ok(!CHAVE_CONVERSA_CLIENTE.test(`conversa/${A}/${B}.mp4`));
  assert.ok(CHAVE_PERFIL.test(`perfil/${B}.jpg`));
  assert.ok(!CHAVE_PERFIL.test(`perfil/${B}.png`));
});

test('pastas: situação do conteúdo, pasta da chave e mudança de pasta', () => {
  assert.equal(pastaDoConteudo({ status: 'rascunho' }), 'trabalho');
  assert.equal(pastaDoConteudo({ status: 'em_aprovacao', na_vitrine: true }), 'trabalho');
  assert.equal(pastaDoConteudo({ status: 'aprovado', na_vitrine: false }), 'aprovados');
  assert.equal(pastaDoConteudo({ status: 'aprovado', na_vitrine: true }), 'vitrine');

  assert.equal(pastaDaChave(`${A}/${B}.jpg`), 'trabalho'); // antigas, sem pasta
  assert.equal(pastaDaChave(`aprovados/${A}/conversa/${B}.jpg`), 'aprovados');
  assert.equal(conteudoDaChave(`vitrine/${A}/${B}.jpg`), A);
  assert.equal(conteudoDaChave('qualquer coisa'), null);

  assert.equal(chaveNaPasta(`trabalho/${A}/${B}.jpg`, 'aprovados'), `aprovados/${A}/${B}.jpg`);
  assert.equal(chaveNaPasta(`${A}/conversa/${B}.m4a`, 'vitrine'), `vitrine/${A}/conversa/${B}.m4a`);
});

test('expiração: 30 dias em aprovados/ e conversa/, nunca nas outras', () => {
  const agora = new Date('2026-10-25T12:00:00Z');
  assert.equal(expiraEm('aprovados', agora), '2026-11-24T12:00:00.000Z');
  assert.equal(expiraEm('conversa', agora), '2026-11-24T12:00:00.000Z');
  assert.equal(expiraEm('trabalho', agora), null);
  assert.equal(expiraEm('vitrine', agora), null);
});

test('tipo pela extensão e ida e volta da URL', () => {
  assert.deepEqual(tipoDaChave(`${A}/${B}.MP4`), { mime: 'video/mp4', tipo: 'video' });
  assert.equal(tipoDaChave(`${A}/${B}.exe`), null);
  const chave = `trabalho/${A}/${B}.jpg`;
  assert.equal(chaveDaUrl(urlDaChave(chave)), chave);
});
