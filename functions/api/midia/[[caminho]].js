// GET /api/midia/<conteudo_id>/<uuid>.<ext>        → mostra o arquivo (com Range para vídeo)
// GET /api/midia/<conteudo_id>/conversa/<uuid>.<ext> → imagem ou áudio da conversa
// GET /api/midia/conversa/<cliente_id>/<uuid>.<ext> → imagem ou áudio da conversa sem conteúdo
// GET /api/midia/perfil/<uuid>.jpg                    → foto de perfil
// GET /api/midia/<conteudo_id>/<uuid>.<ext>?download=1 → baixa o original com o nome do arquivo
// Sem login: a chave é impossível de adivinhar (decisão registrada no CLAUDE.md).
import { CHAVE, CHAVE_CONVERSA, CHAVE_CONVERSA_CLIENTE, CHAVE_PERFIL, tipoDaChave } from '../../_lib/midias.js';

export async function onRequestGet(contexto) {
  return entregar(contexto, true);
}

export async function onRequestHead(contexto) {
  return entregar(contexto, false);
}

async function entregar({ request, env, params }, comCorpo) {
  if (!env.MIDIAS) return new Response('Armazenamento de arquivos não configurado.', { status: 500 });

  const chave = [].concat(params.caminho ?? []).join('/');
  if (![CHAVE, CHAVE_CONVERSA, CHAVE_CONVERSA_CLIENTE, CHAVE_PERFIL].some((r) => r.test(chave))) return new Response('Arquivo não encontrado.', { status: 404 });

  // Lemos o Range nós mesmos (o formato de `objeto.range` varia entre o R2 e o simulador local).
  const trecho = lerRange(request.headers.get('range'));
  let objeto;
  try {
    objeto = comCorpo
      ? await env.MIDIAS.get(chave, { range: trecho ?? undefined, onlyIf: request.headers })
      : await env.MIDIAS.head(chave);
  } catch (err) {
    // Trecho além do fim do arquivo: o R2 lança erro em vez de responder.
    const info = await env.MIDIAS.head(chave);
    if (!info) return new Response('Arquivo não encontrado.', { status: 404 });
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
  }
  if (!objeto) return new Response('Arquivo não encontrado.', { status: 404 });

  const headers = new Headers();
  objeto.writeHttpMetadata(headers);
  // Com nosniff, sem Content-Type o navegador não mostra: vale o da extensão (ver tipoDaChave).
  const tipo = tipoDaChave(chave);
  if (tipo) headers.set('Content-Type', tipo.mime);
  headers.set('ETag', objeto.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');

  if (new URL(request.url).searchParams.has('download')) {
    const nome = objeto.customMetadata?.nome || chave.split('/').pop();
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`);
  }

  // HEAD, ou If-None-Match bateu (o R2 devolve o objeto sem corpo)
  if (!comCorpo) {
    headers.set('Content-Length', String(objeto.size));
    return new Response(null, { status: 200, headers });
  }
  if (!('body' in objeto)) return new Response(null, { status: 304, headers });

  if (trecho) {
    const { inicio, tamanho } = intervalo(trecho, objeto.size);
    if (inicio >= objeto.size || tamanho <= 0) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${objeto.size}` } });
    }
    headers.set('Content-Range', `bytes ${inicio}-${inicio + tamanho - 1}/${objeto.size}`);
    headers.set('Content-Length', String(tamanho));
    return new Response(objeto.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(objeto.size));
  return new Response(objeto.body, { status: 200, headers });
}

// "bytes=0-999" → { offset, length } | "bytes=500-" → { offset } | "bytes=-500" → { suffix }
// Vários intervalos ou formato estranho: ignora e entrega o arquivo inteiro.
function lerRange(cabecalho) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((cabecalho || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return { suffix: Number(m[2]) };
  const offset = Number(m[1]);
  if (m[2] === '') return { offset };
  const fim = Number(m[2]);
  return fim >= offset ? { offset, length: fim - offset + 1 } : null;
}

function intervalo(range, total) {
  if ('suffix' in range) {
    const tamanho = Math.min(range.suffix, total);
    return { inicio: total - tamanho, tamanho };
  }
  const inicio = range.offset;
  const tamanho = Math.min(range.length ?? total - inicio, total - inicio);
  return { inicio, tamanho };
}
