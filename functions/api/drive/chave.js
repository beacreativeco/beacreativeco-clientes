// GET /api/drive/chave   (só a admin)
// Chave de API do Google Picker. O Picker roda no navegador e precisa dela, mas a chave
// não fica no Git nem nos arquivos públicos: vem de GOOGLE_API_KEY (Cloudflare/.dev.vars)
// e só para a Bea logada. No Google Cloud, a chave fica restrita aos sites e à Picker API.
import { responder, exigirAdmin } from '../../_lib/servidor.js';

export async function onRequestGet({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  if (!env.GOOGLE_API_KEY) return responder(500, 'Drive sem chave do Google configurada no servidor.');
  return responder(200, null, { chave: env.GOOGLE_API_KEY });
}
