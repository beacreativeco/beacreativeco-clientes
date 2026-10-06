// GET /api/trello/quadros → { quadros: [{ id, nome }] }
// Os quadros abertos da conta da Bea, para ligar cada cliente ao dela. Só a admin.
import { responder, exigirAdmin } from '../../_lib/servidor.js';
import { trello, trelloConfigurado } from '../../_lib/trello.js';

export async function onRequestGet({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  if (!trelloConfigurado(env)) return responder(500, 'O Trello ainda não foi configurado no servidor.');

  try {
    const quadros = await trello(env, '/members/me/boards', { params: { fields: 'name', filter: 'open' } });
    return responder(200, null, { quadros: quadros.map((q) => ({ id: q.id, nome: q.name })) });
  } catch (err) {
    return responder(502, err.message);
  }
}
