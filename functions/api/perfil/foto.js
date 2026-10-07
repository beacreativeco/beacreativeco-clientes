// PUT    /api/perfil/foto   (corpo = JPEG quadrado, já recortado e comprimido no navegador)
// DELETE /api/perfil/foto   → tira a foto (volta às iniciais)
// Foto de perfil da Bea em perfil/<uuid>.jpg; grava admins.foto_url e apaga a anterior.
// Só a admin, por enquanto (o perfil do cliente é o item 5d).
import { responder, exigirAdmin, rest } from '../../_lib/servidor.js';
import { CHAVE_PERFIL, LIMITE_FOTO_PERFIL_MB, urlDaChave, chaveDaUrl } from '../../_lib/midias.js';

const LIMITE = LIMITE_FOTO_PERFIL_MB * 1024 * 1024;

export async function onRequestPut({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { usuario, resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (tipo !== 'image/jpeg') return responder(400, 'A foto precisa ser JPG.');
  if (Number(request.headers.get('Content-Length')) > LIMITE) return responder(413, `A foto passou de ${LIMITE_FOTO_PERFIL_MB} MB.`);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return responder(400, 'Arquivo vazio.');
  if (bytes.byteLength > LIMITE) return responder(413, `A foto passou de ${LIMITE_FOTO_PERFIL_MB} MB.`);

  const chave = `perfil/${crypto.randomUUID()}.jpg`;
  await env.MIDIAS.put(chave, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  const fotoUrl = urlDaChave(chave);
  await trocarFoto(env, usuario.id, fotoUrl);
  return responder(200, null, { foto_url: fotoUrl });
}

export async function onRequestDelete({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { usuario, resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  await trocarFoto(env, usuario.id, null);
  return responder(200, null, { foto_url: null });
}

// Grava a nova no banco e só então apaga a anterior (nunca fica link quebrado no meio).
async function trocarFoto(env, userId, fotoUrl) {
  const [admin] = (await rest(env, `admins?select=foto_url&user_id=eq.${userId}`)) ?? [];
  await rest(env, `admins?user_id=eq.${userId}`, { metodo: 'PATCH', corpo: { foto_url: fotoUrl }, retornar: false });
  const anterior = chaveDaUrl(admin?.foto_url);
  if (CHAVE_PERFIL.test(anterior)) await env.MIDIAS.delete(anterior);
}
