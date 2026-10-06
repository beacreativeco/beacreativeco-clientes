// POST /api/conversa/limpar  { conteudo_id }   (só a admin)
// Antes de excluir um rascunho: tira do R2 todos os arquivos da conversa dele
// (o banco apaga as mensagens em cascata, mas não alcança o armazenamento).
import { responder, exigirAdmin, UUID } from '../../_lib/servidor.js';

export async function onRequestPost({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const { conteudo_id: conteudoId } = (await request.json().catch(() => null)) ?? {};
  if (!conteudoId || !UUID.test(conteudoId)) return responder(400, 'Conteúdo inválido.');

  let apagados = 0;
  let cursor;
  do {
    const pagina = await env.MIDIAS.list({ prefix: `${conteudoId}/conversa/`, cursor });
    const chaves = pagina.objects.map((o) => o.key);
    if (chaves.length) await env.MIDIAS.delete(chaves);
    apagados += chaves.length;
    cursor = pagina.truncated ? pagina.cursor : undefined;
  } while (cursor);

  return responder(200, null, { apagados });
}
