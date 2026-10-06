// POST /api/trello/refletir  { conteudo_id }
// Sistema → Trello. Chamado pela página depois de enviar ao cliente, retirar, aprovar ou
// pedir ajuste. Não confia em quem chama: lê o estado no banco e deixa o cartão igual a ele.
//   - etiqueta AGUARDANDO APROVAÇÃO enquanto está com o cliente; APROVADO quando aprovado;
//   - um comentário por aprovação ou pedido de ajuste ainda não levado ao Trello;
//   - o anexo "Abrir no sistema de aprovação" (só com SITE_URL, ou seja, com o site no ar).
// Pode ser chamado de novo à vontade: o que já está no cartão não se repete.
import { responder, exigirAcessoConversa, rest, UUID } from '../../_lib/servidor.js';
import { trello, trelloConfigurado } from '../../_lib/trello.js';

const AGUARDANDO = { nome: 'AGUARDANDO APROVAÇÃO', cor: 'yellow' };
const APROVADO = { nome: 'APROVADO', cor: 'green' };
const PREFIXO = 'Sistema de aprovação:';

export async function onRequestPost({ request, env }) {
  const corpo = await request.json().catch(() => null);
  const conteudoId = corpo?.conteudo_id;
  if (!conteudoId || !UUID.test(conteudoId)) return responder(400, 'Conteúdo inválido.');

  const { resposta } = await exigirAcessoConversa(request, env, conteudoId);
  if (resposta) return resposta;
  if (!trelloConfigurado(env)) return responder(200, null, { ok: true, trello: false });

  try {
    return responder(200, null, { ok: true, ...(await refletir(env, conteudoId)) });
  } catch (err) {
    console.error('refletir', conteudoId, err);
    return responder(502, err.message || 'Não foi possível atualizar o Trello.');
  }
}

const quando = (iso) => new Date(iso).toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).replace(', ', ' às ');

async function refletir(env, conteudoId) {
  const [conteudo] = (await rest(env,
    `conteudos?select=id,titulo,status,aprovado_por,trello_card_id,clientes(nome,trello_board_id),conteudos_internos(trello_refletido_ate,trello_anexado)&id=eq.${conteudoId}`)) ?? [];
  if (!conteudo?.trello_card_id || !conteudo.clientes?.trello_board_id) return { trello: false };
  const internos = conteudo.conteudos_internos ?? { trello_refletido_ate: new Date().toISOString(), trello_anexado: false };

  let cartao;
  try {
    cartao = await trello(env, `/cards/${conteudo.trello_card_id}`, { params: { fields: 'idLabels,closed' } });
  } catch {
    return { trello: false, aviso: 'O cartão não foi encontrado no Trello.' };
  }
  if (cartao.closed) return { trello: false, aviso: 'O cartão está arquivado no Trello.' };

  // Etiquetas: iguais à situação no sistema.
  const doQuadro = await trello(env, `/boards/${conteudo.clientes.trello_board_id}/labels`, { params: { fields: 'name,color', limit: '1000' } });
  const etiqueta = async ({ nome, cor }) => doQuadro.find((l) => (l.name ?? '').trim().toUpperCase() === nome)
    ?? trello(env, `/boards/${conteudo.clientes.trello_board_id}/labels`, { metodo: 'POST', params: { name: nome, color: cor } });
  const [aguardando, aprovado] = await Promise.all([etiqueta(AGUARDANDO), etiqueta(APROVADO)]);
  const tem = new Set(cartao.idLabels);
  const querer = (et, sim) => {
    if (sim && !tem.has(et.id)) return trello(env, `/cards/${conteudo.trello_card_id}/idLabels`, { metodo: 'POST', params: { value: et.id } });
    if (!sim && tem.has(et.id)) return trello(env, `/cards/${conteudo.trello_card_id}/idLabels/${et.id}`, { metodo: 'DELETE' });
    return null;
  };
  await Promise.all([querer(aguardando, conteudo.status === 'em_aprovacao'), querer(aprovado, conteudo.status === 'aprovado')]);

  // Comentários: aprovações e pedidos de ajuste que ainda não foram para o cartão.
  const eventos = (await rest(env,
    `mensagens?select=tipo,texto,pedido_ajuste,criado_em&conteudo_id=eq.${conteudoId}&or=(tipo.eq.aprovacao,pedido_ajuste.is.true)&criado_em=gt.${encodeURIComponent(internos.trello_refletido_ate)}&order=criado_em`)) ?? [];
  const link = env.SITE_URL ? `${env.SITE_URL.replace(/\/$/, '')}/admin/conteudo/?id=${conteudoId}` : null;
  const quem = conteudo.clientes.nome;
  let refletidoAte = internos.trello_refletido_ate;
  for (const m of eventos) {
    let texto;
    if (m.tipo === 'aprovacao') {
      texto = conteudo.aprovado_por === 'prazo'
        ? `${PREFIXO} ✦ Aprovado automaticamente (o prazo de ${quem} terminou) em ${quando(m.criado_em)}.`
        : `${PREFIXO} ✦ Aprovado por ${quem} em ${quando(m.criado_em)}.`;
    } else {
      const pedido = m.tipo === 'audio' ? '(mandou um áudio: ouça no sistema)'
        : m.tipo === 'referencia' ? '(mandou uma imagem de referência: veja no sistema)'
        : (m.texto ?? '').split('\n').map((l) => `> ${l}`).join('\n');
      texto = `${PREFIXO} ${quem} pediu ajuste em ${quando(m.criado_em)}:\n\n${pedido}`;
    }
    if (link) texto += `\n\n${link}`;
    await trello(env, `/cards/${conteudo.trello_card_id}/actions/comments`, { metodo: 'POST', params: { text: texto } });
    refletidoAte = m.criado_em;
  }

  // Link do sistema no cartão (uma vez, e só com o site no ar).
  let anexado = internos.trello_anexado;
  if (link && !anexado) {
    await trello(env, `/cards/${conteudo.trello_card_id}/attachments`, {
      metodo: 'POST', params: { url: link, name: 'Abrir no sistema de aprovação' },
    });
    anexado = true;
  }

  if (refletidoAte !== internos.trello_refletido_ate || anexado !== internos.trello_anexado) {
    await rest(env, 'conteudos_internos?on_conflict=conteudo_id', {
      metodo: 'POST', retornar: false, prefer: 'resolution=merge-duplicates',
      corpo: { conteudo_id: conteudoId, trello_refletido_ate: refletidoAte, trello_anexado: anexado },
    });
  }
  return { trello: true, comentarios: eventos.length, anexado };
}
