// POST /api/trello/sincronizar  { cliente_id? }   (sem cliente_id: todos os clientes ligados a um quadro)
// Trello → sistema, todos os quadros de uma vez (regras em functions/_lib/trello-sincronizar.js).
// Chamado ao abrir o Calendário e pelo botão. Com o webhook ligado, o Trello já avisa cada
// mudança sozinho (/api/trello/webhook); isto fica como conferência geral.
import { responder, exigirAdmin, rest, UUID } from '../../_lib/servidor.js';
import { trelloConfigurado } from '../../_lib/trello.js';
import { sincronizarQuadro } from '../../_lib/trello-sincronizar.js';

export async function onRequestPost({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  if (!trelloConfigurado(env)) return responder(500, 'O Trello ainda não foi configurado no servidor.');

  const corpo = await request.json().catch(() => ({}));
  const so = corpo?.cliente_id;
  if (so && !UUID.test(so)) return responder(400, 'Cliente inválido.');

  const clientes = await rest(env,
    `clientes?select=id,nome,trello_board_id&trello_board_id=not.is.null${so ? `&id=eq.${so}` : ''}&order=nome`);

  const resultado = [];
  for (const cliente of clientes ?? []) {
    try {
      resultado.push({ cliente: cliente.nome, ...(await sincronizarQuadro(env, cliente)) });
    } catch (err) {
      console.error('sincronizar', cliente.nome, err);
      resultado.push({ cliente: cliente.nome, erro: err.message || 'Falha ao sincronizar.' });
    }
  }
  return responder(200, null, { resultado, em: new Date().toISOString() });
}
