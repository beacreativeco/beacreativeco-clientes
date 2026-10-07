// Trello → sistema, um quadro de cada vez. Usado pelo botão/abertura do Calendário
// (/api/trello/sincronizar) e pelo aviso do próprio Trello a cada mudança (/api/trello/webhook).
// Cada cartão das listas de entregas ("[FEED] semana…", "conteúdos extras") vira um conteúdo
// em rascunho; nas próximas vezes, título e data seguem o Trello (o formato também, enquanto
// for rascunho). Situação, mídias e legenda nunca são tocadas: são do sistema.
// A etapa (etiquetas), o link do cartão e os avisos vão em conteudos_internos (só a Bea vê).
//
// Cuidado com o limite de 50 requisições por chamada (Cloudflare gratuito): tudo em lote,
// umas 8 por quadro, não importa quantos cartões.
import { rest } from './servidor.js';
import { trello, lerTitulo, ehSeparador, etapasDoCartao, LISTA_DE_ENTREGAS } from './trello.js';

const AVISO_SAIU = 'O cartão saiu das listas de entregas do Trello (arquivado, apagado ou movido).';

export async function sincronizarQuadro(env, cliente) {
  const agora = new Date().toISOString();
  const quadro = await trello(env, `/boards/${cliente.trello_board_id}`, {
    params: {
      fields: 'name', lists: 'open', list_fields: 'name',
      cards: 'open', card_fields: 'name,idList,idLabels,shortUrl', labels: 'all', label_fields: 'name',
    },
  });

  // Os cartões que são entregas, já lidos.
  const listas = new Map(quadro.lists.map((l) => [l.id, l.name]));
  const etiquetas = new Map(quadro.labels.map((l) => [l.id, l]));
  const cartoes = [];
  const ignorados = [];
  for (const c of quadro.cards) {
    const lista = listas.get(c.idList);
    if (!lista || !LISTA_DE_ENTREGAS.test(lista) || ehSeparador(c.name)) continue;
    const lido = lerTitulo(c.name);
    if (!lido.entrega) {
      ignorados.push({ nome: c.name.trim(), url: c.shortUrl });
      continue;
    }
    cartoes.push({ id: c.id, url: c.shortUrl, lista, ...lido,
      etapas: etapasDoCartao(c.idLabels.map((id) => etiquetas.get(id)).filter(Boolean)) });
  }

  const existentes = (await rest(env,
    `conteudos?select=id,trello_card_id,titulo,formato,data_prevista,status,legenda&cliente_id=eq.${cliente.id}&trello_card_id=not.is.null`)) ?? [];
  const porCartao = new Map(existentes.map((c) => [c.trello_card_id, c]));

  // Novos: entram em rascunho, todos de uma vez.
  const novos = cartoes.filter((c) => !porCartao.has(c.id));
  if (novos.length) {
    const criados = await rest(env, 'conteudos?select=id,trello_card_id,titulo,formato,data_prevista,status', {
      metodo: 'POST',
      corpo: novos.map((c) => ({
        cliente_id: cliente.id, titulo: c.titulo, formato: c.formato, data_prevista: c.data,
        status: 'rascunho', trello_card_id: c.id,
      })),
    });
    for (const c of criados) porCartao.set(c.trello_card_id, c);
  }

  // Já existentes: título e data seguem o Trello; formato só enquanto rascunho.
  const mudados = [];
  const avisosExtras = new Map();
  for (const c of cartoes) {
    const atual = porCartao.get(c.id);
    if (novos.includes(c)) continue;
    const formato = atual.status === 'rascunho' ? c.formato : atual.formato;
    if (c.formato !== atual.formato && atual.status !== 'rascunho' && !c.avisos.length) {
      avisosExtras.set(c.id, `No Trello o formato é ${c.formato}; como já foi enviado ao cliente, o sistema manteve ${atual.formato}.`);
    }
    if (atual.titulo !== c.titulo || (atual.data_prevista ?? null) !== c.data || atual.formato !== formato) {
      mudados.push({ id: atual.id, cliente_id: cliente.id, titulo: c.titulo, formato, data_prevista: c.data });
    }
  }
  if (mudados.length) {
    await rest(env, 'conteudos?on_conflict=id', {
      metodo: 'POST', corpo: mudados, retornar: false, prefer: 'resolution=merge-duplicates',
    });
  }

  // Saíram do Trello: só some o rascunho que ainda está vazio (sem mídia, legenda nem
  // observação interna), para não perder nada que a Bea escreveu. O resto fica, com aviso.
  const noTrello = new Set(cartoes.map((c) => c.id));
  const sairam = existentes.filter((c) => !noTrello.has(c.trello_card_id));
  let removidos = [];
  let mantidos = [];
  if (sairam.length) {
    const rascunhos = sairam.filter((c) => c.status === 'rascunho' && !c.legenda?.trim());
    const ids = rascunhos.map((c) => c.id).join(',');
    const [midias, notas] = rascunhos.length
      ? await Promise.all([
        rest(env, `midias?select=conteudo_id&conteudo_id=in.(${ids})`),
        rest(env, `conteudos_internos?select=conteudo_id&observacao_interna=not.is.null&observacao_interna=neq.&conteudo_id=in.(${ids})`),
      ])
      : [[], []];
    const naoVazios = new Set([...(midias ?? []), ...(notas ?? [])].map((m) => m.conteudo_id));
    removidos = rascunhos.filter((c) => !naoVazios.has(c.id));
    mantidos = sairam.filter((c) => !removidos.includes(c));
    if (removidos.length) {
      await rest(env, `conteudos?id=in.(${removidos.map((c) => c.id).join(',')})`, { metodo: 'DELETE', retornar: false });
    }
  }

  // O que só a Bea vê: etapa, link do cartão, lista e avisos (inserir ou atualizar, de uma vez).
  const internos = [
    ...cartoes.map((c) => ({
      conteudo_id: porCartao.get(c.id).id,
      trello_url: c.url,
      trello_lista: c.lista,
      trello_etiquetas: c.etapas,
      trello_aviso: [...c.avisos, avisosExtras.get(c.id)].filter(Boolean).join(' · ') || null,
      trello_sincronizado_em: agora,
    })),
    ...mantidos.map((c) => ({
      conteudo_id: c.id, trello_url: null, trello_lista: null, trello_etiquetas: [],
      trello_aviso: AVISO_SAIU, trello_sincronizado_em: agora,
    })),
  ];
  if (internos.length) {
    await rest(env, 'conteudos_internos?on_conflict=conteudo_id', {
      metodo: 'POST', corpo: internos, retornar: false, prefer: 'resolution=merge-duplicates',
    });
  }

  await rest(env, `clientes?id=eq.${cliente.id}`, {
    metodo: 'PATCH', corpo: { trello_sincronizado_em: agora }, retornar: false,
  });

  return {
    quadro: quadro.name,
    criados: novos.length,
    atualizados: mudados.length,
    removidos: removidos.length,
    saiuDoTrello: mantidos.map((c) => c.titulo),
    semData: cartoes.filter((c) => !c.data).map((c) => c.titulo),
    ignorados,
  };
}
