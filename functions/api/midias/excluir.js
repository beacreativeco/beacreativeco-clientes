// POST /api/midias/excluir  { midia_id }
// Apaga o arquivo do R2 e a linha em `midias`.
import { responder, exigirAdmin, rest, UUID } from '../../_lib/servidor.js';
import { CHAVE, chaveDaUrl } from '../../_lib/midias.js';

export async function onRequestPost({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const { midia_id: midiaId } = (await request.json().catch(() => null)) ?? {};
  if (!midiaId || !UUID.test(midiaId)) return responder(400, 'Mídia inválida.');

  const [midia] = (await rest(env, `midias?select=id,arquivo_url,otimizado_url&id=eq.${midiaId}`)) ?? [];
  if (!midia) return responder(404, 'Mídia não encontrada.');

  const chaves = [midia.arquivo_url, midia.otimizado_url].map(chaveDaUrl).filter((c) => CHAVE.test(c));
  if (chaves.length) await env.MIDIAS.delete(chaves);
  await rest(env, `midias?id=eq.${midiaId}`, { metodo: 'DELETE', retornar: false });

  return responder(200, null, { ok: true });
}
