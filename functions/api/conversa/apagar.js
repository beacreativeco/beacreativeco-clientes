// POST /api/conversa/apagar  { mensagem_id }
// Apaga uma mensagem da conversa e, se tinha áudio ou imagem, tira o arquivo do R2.
// Quem decide se pode é o banco: chamamos apagar_mensagem com o login de quem pediu
// (não com a chave secreta), então valem as mesmas regras da tela.
import { responder, UUID } from '../../_lib/servidor.js';
import { CHAVE_CONVERSA, CHAVE_CONVERSA_CLIENTE, chaveDaUrl } from '../../_lib/midias.js';
import { SUPABASE_ANON_KEY } from '../../../public/assets/js/config.js';

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL) return responder(500, 'Servidor sem configuração do Supabase.');
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return responder(401, 'Sua sessão expirou. Entre de novo.');

  const { mensagem_id: mensagemId } = (await request.json().catch(() => null)) ?? {};
  if (!mensagemId || !UUID.test(mensagemId)) return responder(400, 'Mensagem inválida.');

  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/apagar_mensagem`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_mensagem_id: mensagemId }),
  });
  const corpo = await resp.json().catch(() => null);
  if (!resp.ok) {
    if (resp.status === 401) return responder(401, 'Sua sessão expirou. Entre de novo.');
    // P0001: mensagem escrita no banco para a pessoa ler.
    return responder(400, corpo?.code === 'P0001' ? corpo.message : 'Não foi possível apagar a mensagem.');
  }

  const chave = chaveDaUrl(corpo);
  if (env.MIDIAS && (CHAVE_CONVERSA.test(chave) || CHAVE_CONVERSA_CLIENTE.test(chave))) await env.MIDIAS.delete(chave);
  return responder(200, null, { ok: true });
}
