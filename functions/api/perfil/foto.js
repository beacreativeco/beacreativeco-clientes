// PUT    /api/perfil/foto   (corpo = JPEG quadrado, já recortado e comprimido no navegador)
// DELETE /api/perfil/foto   → tira a foto (volta às iniciais)
// Foto de perfil em perfil/<uuid>.jpg; apaga a anterior. Serve aos dois lados:
// a Bea grava em admins.foto_url; o cliente (login ativo) em clientes.contato_foto_url.
import { responder, rest } from '../../_lib/servidor.js';
import { CHAVE_PERFIL, LIMITE_FOTO_PERFIL_MB, urlDaChave, chaveDaUrl } from '../../_lib/midias.js';

const LIMITE = LIMITE_FOTO_PERFIL_MB * 1024 * 1024;

// De quem é a foto: devolve { linha, coluna } (onde gravar) ou { resposta } (erro pronto).
async function donoDaFoto(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { resposta: responder(500, 'Servidor sem configuração do Supabase.') };
  }
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { resposta: responder(401, 'Sua sessão expirou. Entre de novo.') };
  const respUsuario = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!respUsuario.ok) return { resposta: responder(401, 'Sua sessão expirou. Entre de novo.') };
  const { id } = await respUsuario.json();

  const admins = await rest(env, `admins?select=user_id&user_id=eq.${id}`);
  if (admins?.length) return { linha: `admins?user_id=eq.${id}`, coluna: 'foto_url' };

  const [cliente] = (await rest(env, `clientes?select=id&user_id=eq.${id}&login_ativo=is.true`)) ?? [];
  if (cliente) return { linha: `clientes?id=eq.${cliente.id}`, coluna: 'contato_foto_url' };

  return { resposta: responder(403, 'Seu acesso não está ativo no momento.') };
}

export async function onRequestPut({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { resposta, ...dono } = await donoDaFoto(request, env);
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
  await trocarFoto(env, dono, fotoUrl);
  return responder(200, null, { foto_url: fotoUrl });
}

export async function onRequestDelete({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { resposta, ...dono } = await donoDaFoto(request, env);
  if (resposta) return resposta;
  await trocarFoto(env, dono, null);
  return responder(200, null, { foto_url: null });
}

// Grava a nova no banco e só então apaga a anterior (nunca fica link quebrado no meio).
async function trocarFoto(env, { linha, coluna }, fotoUrl) {
  const [atual] = (await rest(env, `${linha}&select=${coluna}`)) ?? [];
  await rest(env, linha, { metodo: 'PATCH', corpo: { [coluna]: fotoUrl }, retornar: false });
  const anterior = chaveDaUrl(atual?.[coluna]);
  if (CHAVE_PERFIL.test(anterior)) await env.MIDIAS.delete(anterior);
}
