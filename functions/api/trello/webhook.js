// HEAD /api/trello/webhook → 200 (o Trello confere que o endereço existe ao criar o webhook)
// POST /api/trello/webhook  ← aviso do Trello: algo mudou num quadro
// Sem login (quem chama é o Trello): vale a assinatura X-Trello-Webhook, conferida com
// TRELLO_API_SECRET. Responde na hora e sincroniza o quadro em seguida (waitUntil), porque o
// Trello desiste se a resposta demora.
import { rest } from '../../_lib/servidor.js';
import { webhookConfigurado, assinaturaValida, acaoInteressa } from '../../_lib/trello-webhook.js';
import { sincronizarQuadro } from '../../_lib/trello-sincronizar.js';

export function onRequestHead() {
  return new Response(null, { status: 200 });
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!webhookConfigurado(env)) return new Response('Webhook não configurado.', { status: 503 });

  const corpo = await request.text();
  if (!(await assinaturaValida(env, corpo, request.headers.get('x-trello-webhook')))) {
    return new Response('Assinatura inválida.', { status: 401 });
  }

  let aviso;
  try {
    aviso = JSON.parse(corpo);
  } catch {
    return new Response('Aviso inválido.', { status: 400 });
  }

  const quadro = aviso.model?.id;
  const clientes = quadro
    ? await rest(env, `clientes?select=id,nome,trello_board_id&trello_board_id=eq.${encodeURIComponent(quadro)}`)
    : [];
  // Quadro sem cliente (desligado no cadastro): 410 faz o Trello apagar este webhook sozinho.
  if (!clientes?.length) return new Response('Quadro não ligado a nenhum cliente.', { status: 410 });

  if (acaoInteressa(aviso.action)) {
    waitUntil((async () => {
      for (const cliente of clientes) {
        try {
          await sincronizarQuadro(env, cliente);
        } catch (err) {
          console.error('webhook: sincronizar', cliente.nome, aviso.action?.type, err);
        }
      }
    })());
  }
  return new Response(null, { status: 200 });
}
