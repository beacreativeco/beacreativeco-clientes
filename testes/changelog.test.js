// O public/CHANGELOG.md é lido pela janela "Sobre o sistema" (a primeira entrada é a versão
// atual). Confere o formato combinado no CLAUDE.md, seção "Versão", a cada subida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerChangelog } from '../public/assets/js/sobre.js';

const texto = readFileSync(new URL('../public/CHANGELOG.md', import.meta.url), 'utf8');
const versoes = lerChangelog(texto);
const numero = (v) => v.split('.').map(Number);
const maior = (a, b) => {
  const [x, y] = [numero(a), numero(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

test('cada versão tem data dd/mm/aaaa e vem depois da anterior', () => {
  assert.ok(versoes.length > 0);
  for (const [i, v] of versoes.entries()) {
    assert.match(v.data, /^\d{2}\/\d{2}\/\d{4}$/, `${v.versao}: data "${v.data}"`);
    if (i > 0) assert.ok(maior(versoes[i - 1].versao, v.versao), `${versoes[i - 1].versao} deveria ser maior que ${v.versao}`);
  }
});

test('seções combinadas, cada uma com itens, sem formatação markdown', () => {
  for (const v of versoes) {
    assert.ok(v.secoes.length > 0, `${v.versao}: sem seções`);
    for (const s of v.secoes) {
      assert.ok(['Novidades', 'Melhorias', 'Correções'].includes(s.titulo), `${v.versao}: seção "${s.titulo}"`);
      assert.ok(s.itens.length > 0, `${v.versao}: "${s.titulo}" sem itens`);
      for (const item of s.itens) assert.doesNotMatch(item, /\*\*|`|\]\(/, `${v.versao}: "${item}"`);
    }
  }
});

test('lerChangelog: formato da janela "Sobre"', () => {
  const lido = lerChangelog('Intro\n\n## [2.0.0] — 01/02/2027\r\n\n### Novidades\n\n- Uma coisa\n- Outra\n\n## [1.0.0] - 01/01/2027\n### Correções\n- Antiga\n');
  assert.deepEqual(lido, [
    { versao: '2.0.0', data: '01/02/2027', secoes: [{ titulo: 'Novidades', itens: ['Uma coisa', 'Outra'] }] },
    { versao: '1.0.0', data: '01/01/2027', secoes: [{ titulo: 'Correções', itens: ['Antiga'] }] },
  ]);
});
