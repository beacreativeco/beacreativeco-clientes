// POST /api/push/teste   (quem está logado)
// "Enviar notificação de teste" (seção Notificações do perfil): manda um aviso para todos os
// aparelhos de quem pediu. Só para os próprios aparelhos, então vale também no Preview.
import { responder, usuarioDaSessao } from '../../_lib/servidor.js';
import { avisarUsuario } from '../../_lib/webpush.js';

export async function onRequestPost({ request, env }) {
  if (!env.VAPID_PRIVATE_KEY) return responder(500, 'Notificações não configuradas no servidor (VAPID_PRIVATE_KEY).');
  const { usuario, resposta } = await usuarioDaSessao(request, env);
  if (resposta) return resposta;

  // Tocar no teste volta para a página de onde ele foi pedido (só caminhos do próprio site).
  const voltar = new URL(request.url).searchParams.get('voltar') ?? '';
  const entregues = await avisarUsuario(env, usuario.id, {
    titulo: 'BeaCreative',
    corpo: 'Notificação de teste. Está tudo certo: os avisos vão chegar aqui.',
    url: /^\/(?!\/)[\w\-/?=&.]*$/.test(voltar) ? voltar : '/',
    tag: 'teste',
  });
  if (!entregues) return responder(404, 'Nenhum aparelho com as notificações ativadas. Ative neste aparelho e tente de novo.');
  return responder(200, null, { entregues });
}
