// POST /api/trello/webhooks → { webhooks: { quadros, criados, removidos, falharam } | null, faltando? }
// Deixa um webhook do Trello para cada quadro ligado a um cliente (e nenhum para os outros).
// Chamado pela página Clientes depois de salvar e pelo Calendário depois de sincronizar.
// Só a admin, e só na produção: no Preview e no localhost não faz nada (os webhooks são
// os da produção; mexer neles daqui apagaria ou duplicaria os avisos do site oficial).
import { responder, exigirAdmin } from '../../_lib/servidor.js';
import { ehProducao } from '../../_lib/ambiente.js';
import { webhookConfigurado, variaveisFaltando, garantirWebhooks } from '../../_lib/trello-webhook.js';

export async function onRequestPost({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  if (!ehProducao(request)) return responder(200, null, { webhooks: null, producao: false });
  if (!webhookConfigurado(env)) return responder(200, null, { webhooks: null, faltando: variaveisFaltando(env) });

  try {
    return responder(200, null, { webhooks: await garantirWebhooks(env) });
  } catch (err) {
    console.error('webhooks do Trello', err);
    return responder(502, err.message || 'Não foi possível ligar os avisos do Trello.');
  }
}
