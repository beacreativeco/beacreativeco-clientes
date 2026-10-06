// POST /api/midias/abortar  { chave, uploadId }
// Cancela um upload em partes (o R2 descarta o que já tinha chegado).
import { responder, exigirAdmin } from '../../_lib/servidor.js';
import { CHAVE } from '../../_lib/midias.js';

export async function onRequestPost({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const { chave, uploadId } = (await request.json().catch(() => null)) ?? {};
  if (!CHAVE.test(chave || '') || !uploadId) return responder(400, 'Upload inválido.');

  try {
    await env.MIDIAS.resumeMultipartUpload(chave, uploadId).abort();
  } catch (err) {
    console.error('abort', err); // já concluído ou já cancelado: nada a fazer
  }
  return responder(200, null, { ok: true });
}
