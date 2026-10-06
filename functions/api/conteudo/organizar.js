// POST /api/conteudo/organizar  { conteudo_id }
// Chamado pela página depois que a situação de um conteúdo muda (enviado, retirado, aprovado,
// pedido de ajuste). Lê o estado no banco e acerta o que fica fora dele:
//   1. arquivos na pasta certa do R2 (trabalho/, aprovados/, vitrine/), com a data em que expiram;
//   2. o cartão do Trello (etiquetas, comentários, link do sistema).
// A Bea ou o cliente dono do conteúdo podem chamar; nada aqui confia no que a página diz.
import { responder, exigirAcessoConversa, UUID } from '../../_lib/servidor.js';
import { organizarArquivos } from '../../_lib/armazenamento.js';
import { refletirNoTrello } from '../../_lib/trello-refletir.js';
import { trelloConfigurado } from '../../_lib/trello.js';

export async function onRequestPost({ request, env }) {
  const corpo = await request.json().catch(() => null);
  const conteudoId = corpo?.conteudo_id;
  if (!conteudoId || !UUID.test(conteudoId)) return responder(400, 'Conteúdo inválido.');

  const { resposta } = await exigirAcessoConversa(request, env, conteudoId);
  if (resposta) return resposta;

  // Um não impede o outro: o Trello fora do ar não deixa arquivo na pasta errada, e vice-versa.
  const resultado = {};
  if (env.MIDIAS) {
    try {
      resultado.arquivos = await organizarArquivos(env, conteudoId);
    } catch (err) {
      console.error('organizar arquivos', conteudoId, err);
      resultado.arquivos = { erro: 'Não foi possível organizar os arquivos.' };
    }
  }
  if (trelloConfigurado(env)) {
    try {
      resultado.trello = await refletirNoTrello(env, conteudoId);
    } catch (err) {
      console.error('refletir no Trello', conteudoId, err);
      resultado.trello = { erro: err.message || 'Não foi possível atualizar o Trello.' };
    }
  }
  return responder(200, null, resultado);
}
