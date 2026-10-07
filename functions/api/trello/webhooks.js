// POST /api/trello/webhooks → { webhooks: { quadros, criados, removidos, falharam } | null }
// Deixa um webhook do Trello para cada quadro ligado a um cliente (e nenhum para os outros).
// Chamado pela página Clientes depois de salvar e pelo Calendário depois de sincronizar.
// Só a admin. Fora do ar (sem SITE_URL) não faz nada: o Trello não alcança o localhost.
import { responder, exigirAdmin } from '../../_lib/servidor.js';
import { webhookConfigurado, garantirWebhooks } from '../../_lib/trello-webhook.js';

export async function onRequestPost({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  if (!webhookConfigurado(env)) return responder(200, null, { webhooks: null });

  try {
    return responder(200, null, { webhooks: await garantirWebhooks(env) });
  } catch (err) {
    console.error('webhooks do Trello', err);
    return responder(502, err.message || 'Não foi possível ligar os avisos do Trello.');
  }
}
