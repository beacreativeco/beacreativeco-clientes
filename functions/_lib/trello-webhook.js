// Webhook do Trello: o próprio Trello avisa /api/trello/webhook a cada mudança num quadro ligado
// a um cliente, e o sistema sincroniza só aquele quadro (functions/_lib/trello-sincronizar.js).
// Só funciona com o site no ar (o Trello precisa alcançar SITE_URL) e com TRELLO_API_SECRET,
// que confere a assinatura de cada aviso (ninguém de fora consegue disparar sincronizações).
import { rest } from './servidor.js';
import { trello, trelloConfigurado } from './trello.js';

const NECESSARIAS = ['TRELLO_API_KEY', 'TRELLO_TOKEN', 'TRELLO_API_SECRET', 'SITE_URL'];

/** Nomes (nunca os valores) das variáveis que faltam no servidor para o webhook. */
export function variaveisFaltando(env) {
  return NECESSARIAS.filter((nome) => !env[nome]?.trim());
}

export function webhookConfigurado(env) {
  return trelloConfigurado(env) && variaveisFaltando(env).length === 0;
}

// Precisa ser exatamente o endereço registrado: entra no cálculo da assinatura.
export function enderecoDoWebhook(env) {
  return `${env.SITE_URL.trim().replace(/\/$/, '')}/api/trello/webhook`;
}

// Assinatura do Trello: base64(HMAC-SHA1(secret, corpo + endereço do webhook)).
export async function assinaturaValida(env, corpo, assinatura) {
  if (!assinatura) return false;
  const codificar = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    'raw', codificar.encode(env.TRELLO_API_SECRET.trim()), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', chave, codificar.encode(corpo + enderecoDoWebhook(env))));
  const esperada = btoa(String.fromCharCode(...bytes));
  if (esperada.length !== assinatura.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperada.length; i++) diferenca |= esperada.charCodeAt(i) ^ assinatura.charCodeAt(i);
  return diferenca === 0;
}

// O que muda alguma coisa no sistema (título, data, formato, lista, etapa, cartão saindo).
// Comentários, anexos, descrição, membros e arrastar dentro da lista não sincronizam.
const ACOES = new Set([
  'createCard', 'copyCard', 'deleteCard', 'moveCardToBoard', 'moveCardFromBoard',
  'convertToCardFromCheckItem', 'addLabelToCard', 'removeLabelFromCard',
  'updateLabel', 'deleteLabel', 'moveListToBoard', 'moveListFromBoard',
]);
const CAMPOS_CARTAO = ['name', 'idList', 'closed'];
const CAMPOS_LISTA = ['name', 'closed'];

export function acaoInteressa(acao) {
  if (!acao) return false;
  const mudou = (campos) => campos.some((c) => c in (acao.data?.old ?? {}));
  if (acao.type === 'updateCard') return mudou(CAMPOS_CARTAO);
  if (acao.type === 'updateList') return mudou(CAMPOS_LISTA);
  return ACOES.has(acao.type);
}

/**
 * Um webhook para cada quadro ligado a um cliente, nenhum para os outros.
 * Pode rodar à vontade: o que já está certo não é tocado.
 */
export async function garantirWebhooks(env) {
  const endereco = enderecoDoWebhook(env);
  const [clientes, existentes] = await Promise.all([
    rest(env, 'clientes?select=trello_board_id&trello_board_id=not.is.null'),
    trello(env, `/tokens/${env.TRELLO_TOKEN}/webhooks`),
  ]);
  const quadros = new Set((clientes ?? []).map((c) => c.trello_board_id));
  const nossos = existentes.filter((w) => w.callbackURL === endereco);

  // Desligado no Trello (ex.: depois de muitas falhas seguidas) conta como faltando.
  const sobrando = nossos.filter((w) => !quadros.has(w.idModel) || !w.active);
  const ativos = new Set(nossos.filter((w) => w.active).map((w) => w.idModel));
  const faltando = [...quadros].filter((id) => !ativos.has(id));

  await Promise.all(sobrando.map((w) => trello(env, `/webhooks/${w.id}`, { metodo: 'DELETE' })));
  const criados = [];
  for (const idModel of faltando) {
    try {
      await trello(env, '/webhooks', {
        metodo: 'POST', params: { callbackURL: endereco, idModel, description: 'Sistema de aprovação BeaCreative' },
      });
      criados.push(idModel);
    } catch (err) {
      console.error('webhook do Trello', idModel, err);
    }
  }
  return { quadros: quadros.size, criados: criados.length, removidos: sobrando.length, falharam: faltando.length - criados.length };
}
