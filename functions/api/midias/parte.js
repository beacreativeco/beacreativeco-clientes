// PUT /api/midias/parte?chave=...&uploadId=...&n=1   (corpo = bytes da parte)
// Devolve { partNumber, etag } para o navegador guardar até concluir.
import { responder, exigirAdmin } from '../../_lib/servidor.js';
import { CHAVE, TAMANHO_PARTE } from '../../_lib/midias.js';

export async function onRequestPut({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const url = new URL(request.url);
  const chave = url.searchParams.get('chave');
  const uploadId = url.searchParams.get('uploadId');
  const n = Number(url.searchParams.get('n'));
  if (!CHAVE.test(chave || '') || !uploadId || !Number.isInteger(n) || n < 1 || n > 10000) {
    return responder(400, 'Parte inválida.');
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > TAMANHO_PARTE) return responder(400, 'Tamanho de parte inválido.');

  try {
    const upload = env.MIDIAS.resumeMultipartUpload(chave, uploadId);
    const parte = await upload.uploadPart(n, bytes);
    return responder(200, null, { partNumber: parte.partNumber, etag: parte.etag });
  } catch (err) {
    console.error('uploadPart', err);
    return responder(502, 'Não foi possível guardar esta parte do arquivo.');
  }
}
