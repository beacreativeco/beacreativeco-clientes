// Regras de arquivo por formato (editor da Bea): o que entra e quando dá para enviar ao cliente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemaDoArquivo, problemaDasMidias, tipoMime } from '../public/assets/js/conteudos.js';

const arquivo = (name, type, mb = 1) => ({ name, type, size: mb * 1024 * 1024 });

test('tipo do arquivo: pelo navegador ou, sem ele, pela extensão', () => {
  assert.equal(tipoMime(arquivo('a.jpg', 'image/jpeg')), 'image/jpeg');
  assert.equal(tipoMime(arquivo('Video.MOV', '')), 'video/quicktime');
  assert.equal(tipoMime(arquivo('a.heic', 'image/heic')), 'image/heic');
});

test('arquivo aceito ou recusado, com o motivo', () => {
  assert.equal(problemaDoArquivo(arquivo('a.jpg', 'image/jpeg'), 'post'), null);
  assert.equal(problemaDoArquivo(arquivo('v.mov', ''), 'reels'), null);
  assert.equal(problemaDoArquivo(arquivo('v.mp4', 'video/mp4'), 'carrossel'), null);
  assert.match(problemaDoArquivo(arquivo('IMG_1.HEIC', ''), 'post'), /HEIC/);
  assert.match(problemaDoArquivo(arquivo('doc.pdf', 'application/pdf'), 'post'), /formato não aceito/);
  assert.match(problemaDoArquivo(arquivo('a.jpg', 'image/jpeg'), 'reels'), /aceita só vídeo/);
  assert.match(problemaDoArquivo(arquivo('v.mp4', 'video/mp4'), 'post'), /aceita só imagem/);
  assert.match(problemaDoArquivo(arquivo('a.jpg', 'image/jpeg', 31), 'post'), /limite de 30 MB/);
  assert.equal(problemaDoArquivo(arquivo('v.mp4', 'video/mp4', 2048), 'reels'), null);
  assert.match(problemaDoArquivo(arquivo('v.mp4', 'video/mp4', 2049), 'reels'), /limite de 2\.048 MB/);
});

test('quantidade e tipo das mídias para enviar ao cliente', () => {
  const img = { tipo: 'imagem' };
  const vid = { tipo: 'video' };
  assert.equal(problemaDasMidias('post', [img]), null);
  assert.equal(problemaDasMidias('reels', [vid]), null);
  assert.equal(problemaDasMidias('carrossel', [img, vid]), null);
  assert.equal(problemaDasMidias('story', [vid, img, img]), null);
  assert.match(problemaDasMidias('post', []), /Adicione os arquivos/);
  assert.match(problemaDasMidias('carrossel', [img]), /pelo menos 2/);
  assert.match(problemaDasMidias('post', [img, img]), /no máximo 1 arquivo\./);
  assert.match(problemaDasMidias('reels', [img]), /não aceita imagem/);
  assert.match(problemaDasMidias('carrossel', Array(21).fill(img)), /no máximo 20 arquivos/);
});
