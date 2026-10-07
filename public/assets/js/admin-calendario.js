// Calendário da Bea: as entregas de todos os clientes no mês, quantas de cada um,
// e os conteúdos ainda sem data. Computador: grade do mês. Celular: lista por dia.
// Complementa o Trello: ao abrir, puxa os cartões dos quadros ligados aos clientes
// (/api/trello/sincronizar) e mostra a etapa de cada entrega (etiquetas do cartão).
import { supabase, chamarServidor } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';
import { FORMATOS, SITUACOES, lerData, parametro } from './conteudos.js';

// Uma cor por cliente, combinando com a identidade (creme, espresso, periwinkle).
const CORES = ['#7B85CE', '#C07A5A', '#6F9A7E', '#C9A23F', '#B56B8E', '#4F8A9A', '#8C6BB1', '#9A7B5C'];
const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// O que só a Bea vê, vindo do Trello (etapa = última etiqueta de produção do cartão).
const INTERNOS = 'conteudos_internos(trello_etiquetas, trello_url, trello_aviso)';
// Postado no Trello antes de passar pelo sistema: só registro no calendário.
const postado = (c) => c.status === 'rascunho' && (c.conteudos_internos?.trello_etiquetas ?? []).includes('POSTADO');
const etapa = (c) => {
  const ultima = (c.conteudos_internos?.trello_etiquetas ?? []).at(-1);
  return ultima ? ultima.charAt(0) + ultima.slice(1).toLowerCase() : null;
};

const $ = (id) => document.getElementById(id);

function el(tag, classe, ...filhos) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) n.append(f);
  return n;
}

let clientes = [];          // [{ id, nome, cor }]
let porId = new Map();
let mes;                    // Date no dia 1 do mês aberto
let entregas = [];          // conteúdos com data na grade do mês
let filtro = null;          // id do cliente escolhido no resumo, ou null (todos)

// "2026-10" (da URL) ou o mês de hoje.
function mesInicial() {
  const m = /^(\d{4})-(\d{2})$/.exec(parametro('mes') ?? '');
  const hoje = new Date();
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const chaveMes = (d) => iso(d).slice(0, 7);
const mesmoDia = (a, b) => a.toDateString() === b.toDateString();

// Map.groupBy só chegou no Safari 17.4: aqui vai na mão, para iPhones mais antigos.
function agruparPorDia(lista) {
  const grupos = new Map();
  for (const c of lista) grupos.set(c.data_prevista, [...(grupos.get(c.data_prevista) ?? []), c]);
  return grupos;
}

// Cor estável por cliente: a do "hash" do id; se já foi usada, a próxima livre.
function darCores(lista) {
  const usadas = new Set();
  for (const c of [...lista].sort((a, b) => a.id.localeCompare(b.id))) {
    let i = [...c.id].reduce((soma, ch) => soma + ch.charCodeAt(0), 0) % CORES.length;
    for (let tentativa = 0; tentativa < CORES.length && usadas.has(i); tentativa++) i = (i + 1) % CORES.length;
    usadas.add(i);
    c.cor = CORES[i];
  }
  return lista;
}

// Primeiro domingo da grade até o último sábado (5 ou 6 semanas).
function limitesDaGrade(primeiro) {
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0);
  const fim = new Date(ultimo);
  fim.setDate(ultimo.getDate() + (6 - ultimo.getDay()));
  return { inicio, fim };
}

iniciarPagina('admin', async () => {
  $('sair').addEventListener('click', sair);
  $('mes-anterior').addEventListener('click', () => irPara(-1));
  $('mes-seguinte').addEventListener('click', () => irPara(1));
  $('mes-hoje').addEventListener('click', () => irPara(0));
  $('resumo-clientes').addEventListener('click', (e) => {
    const botao = e.target.closest('button[data-cliente]');
    if (!botao) return;
    filtro = filtro === botao.dataset.cliente ? null : botao.dataset.cliente;
    desenhar();
  });

  const { data, error } = await supabase.from('clientes')
    .select('id, nome, trello_board_id, trello_sincronizado_em').is('arquivado_em', null).order('nome');
  if (error) throw error;
  clientes = darCores(data);
  porId = new Map(clientes.map((c) => [c.id, c]));

  mes = mesInicial();
  await Promise.all([carregarMes(), carregarSemData()]);
  desenhar();

  // Algum cliente ligado a um quadro: mostra o Trello e já sincroniza (sem travar a página).
  if (clientes.some((c) => c.trello_board_id)) {
    $('trello').hidden = false;
    const ultima = clientes.map((c) => c.trello_sincronizado_em).filter(Boolean).sort().at(-1);
    mostrarStatus(ultima ? `Trello atualizado ${quando(ultima)}.` : 'Ainda não sincronizado com o Trello.');
    $('sincronizar').addEventListener('click', () => sincronizar(true));
    setTimeout(() => sincronizar(false), 0);
  }
});

// ---------------------------------------------------------------- Trello

// Confere que o Trello avisa o sistema de cada mudança nos quadros (webhook; só com o site
// no ar). Em silêncio: se falhar, a sincronização ao abrir o Calendário continua valendo.
function ligarAvisosDoTrello() {
  chamarServidor('/api/trello/webhooks', { metodo: 'POST', corpo: {} }).catch(console.error);
}

const quando = (isoTs) => {
  const d = new Date(isoTs);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return mesmoDia(d, new Date()) ? `hoje às ${hora}` : `em ${d.toLocaleDateString('pt-BR')} às ${hora}`;
};

function mostrarStatus(texto) {
  $('trello-status').textContent = texto;
}

let sincronizando = false;
async function sincronizar(pedidoPelaBea) {
  if (sincronizando) return;
  sincronizando = true;
  const botao = $('sincronizar');
  botao.disabled = true;
  mostrarStatus('Buscando no Trello…');
  try {
    const { resultado, em } = await chamarServidor('/api/trello/sincronizar', { metodo: 'POST', corpo: {} });
    await Promise.all([carregarMes(), carregarSemData()]);
    desenhar();
    mostrarStatus(`Trello atualizado ${quando(em)}.`);
    mostrarAvisos(resultado);
    ligarAvisosDoTrello();
    const novos = resultado.reduce((s, r) => s + (r.criados ?? 0), 0);
    const mudados = resultado.reduce((s, r) => s + (r.atualizados ?? 0), 0);
    const falhas = resultado.filter((r) => r.erro);
    if (falhas.length) avisar(`Não deu para ler o Trello de ${falhas.map((r) => r.cliente).join(', ')}.`, 'erro');
    else if (pedidoPelaBea || novos || mudados) {
      avisar(novos || mudados
        ? `Do Trello: ${novos} ${novos === 1 ? 'entrega nova' : 'entregas novas'} e ${mudados} ${mudados === 1 ? 'atualizada' : 'atualizadas'}.`
        : 'Tudo igual ao Trello.');
    }
  } catch (err) {
    console.error(err);
    mostrarStatus('Não foi possível falar com o Trello agora.');
    if (pedidoPelaBea) avisar(err.message, 'erro');
  } finally {
    sincronizando = false;
    botao.disabled = false;
  }
}

// O que precisa de atenção no Trello: cartões que saíram, ignorados e erros.
function mostrarAvisos(resultado) {
  const itens = [];
  for (const r of resultado) {
    if (r.erro) itens.push(`${r.cliente}: ${r.erro}`);
    for (const t of r.saiuDoTrello ?? []) itens.push(`${r.cliente}: "${t}" saiu das listas de entregas do Trello, mas continua aqui (já tem conteúdo ou foi enviado).`);
    for (const c of r.ignorados ?? []) itens.push(`${r.cliente}: o cartão "${c.nome}" não tem data nem formato no título, então não virou entrega.`);
  }
  const avisos = $('trello-avisos');
  avisos.hidden = itens.length === 0;
  avisos.querySelector('summary').textContent = `${itens.length} ${itens.length === 1 ? 'aviso' : 'avisos'} do Trello`;
  $('trello-avisos-lista').replaceChildren(...itens.map((t) => el('li', null, t)));
}

async function irPara(passo) {
  const hoje = new Date();
  mes = passo === 0 ? new Date(hoje.getFullYear(), hoje.getMonth(), 1) : new Date(mes.getFullYear(), mes.getMonth() + passo, 1);
  history.replaceState(null, '', `?mes=${chaveMes(mes)}`);
  try {
    await carregarMes();
    desenhar();
  } catch (err) {
    console.error(err);
    avisar('Não foi possível carregar o mês. Confira sua internet e tente de novo.', 'erro');
  }
}

async function carregarMes() {
  const { inicio, fim } = limitesDaGrade(mes);
  const { data, error } = await supabase.from('conteudos')
    .select(`id, cliente_id, titulo, formato, status, data_prevista, ${INTERNOS}`)
    .gte('data_prevista', iso(inicio)).lte('data_prevista', iso(fim))
    .order('data_prevista').order('criado_em');
  if (error) throw error;
  entregas = data;
}

async function carregarSemData() {
  const { data, error } = await supabase.from('conteudos')
    .select(`id, cliente_id, titulo, formato, status, data_prevista, ${INTERNOS}`)
    .is('data_prevista', null).order('criado_em');
  if (error) throw error;
  const secao = $('sem-data');
  secao.hidden = data.length === 0;
  $('lista-sem-data').replaceChildren(...data.map((c) => itemDaLista(c)));
}

// ---------------------------------------------------------------- desenho

function desenhar() {
  const nomeDoMes = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  $('mes-nome').textContent = nomeDoMes.charAt(0).toUpperCase() + nomeDoMes.slice(1);
  document.title = `Calendário · ${nomeDoMes} · BeaCreative`;

  const doMes = entregas.filter((c) => c.data_prevista.startsWith(chaveMes(mes)));
  desenharResumo(doMes);

  const visiveis = filtro ? entregas.filter((c) => c.cliente_id === filtro) : entregas;
  $('cal-vazio').hidden = visiveis.some((c) => c.data_prevista.startsWith(chaveMes(mes)));
  desenharGrade(visiveis);
  desenharLista(visiveis.filter((c) => c.data_prevista.startsWith(chaveMes(mes))));
}

function desenharResumo(doMes) {
  const aprovadas = doMes.filter((c) => c.status === 'aprovado').length;
  const postadas = doMes.filter(postado).length;
  const mesCurto = mes.toLocaleDateString('pt-BR', { month: 'long' });
  $('resumo-total').textContent = doMes.length
    ? [`${doMes.length} ${doMes.length === 1 ? 'entrega' : 'entregas'} em ${mesCurto}`,
      `${aprovadas} ${aprovadas === 1 ? 'aprovada' : 'aprovadas'}`,
      postadas ? `${postadas} já ${postadas === 1 ? 'postada' : 'postadas'} no Trello` : null].filter(Boolean).join(' · ')
    : `Nenhuma entrega em ${mesCurto}.`;

  $('resumo-clientes').replaceChildren(...clientes.map((c) => {
    const dele = doMes.filter((e) => e.cliente_id === c.id);
    const ok = dele.filter((e) => e.status === 'aprovado').length;
    const botao = el('button', 'cal-cliente',
      el('span', 'cal-cor'),
      el('span', 'cal-cliente-nome', c.nome),
      el('span', 'cal-cliente-total', String(dele.length)),
      el('span', 'cal-cliente-ok', ok ? `${ok} ✦` : ''));
    botao.type = 'button';
    botao.dataset.cliente = c.id;
    botao.style.setProperty('--cor', c.cor);
    botao.setAttribute('aria-pressed', String(filtro === c.id));
    botao.setAttribute('aria-label',
      `${c.nome}: ${dele.length} ${dele.length === 1 ? 'entrega' : 'entregas'}, ${ok} ${ok === 1 ? 'aprovada' : 'aprovadas'}. ${filtro === c.id ? 'Mostrando só este cliente.' : 'Mostrar só este cliente.'}`);
    return el('li', null, botao);
  }));
}

function desenharGrade(visiveis) {
  const { inicio, fim } = limitesDaGrade(mes);
  const hoje = new Date();
  const porDia = agruparPorDia(visiveis);

  const cabecalho = el('div', 'cal-semana cal-cabecalho', DIAS_DA_SEMANA.map((d) => {
    const n = el('span', null, d);
    n.setAttribute('role', 'columnheader');
    return n;
  }));
  cabecalho.setAttribute('role', 'row');

  const semanas = [];
  for (const d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) {
      const semana = el('div', 'cal-semana');
      semana.setAttribute('role', 'row');
      semanas.push(semana);
    }
    const dia = new Date(d);
    const doDia = porDia.get(iso(dia)) ?? [];
    const celula = el('div', 'cal-dia',
      el('span', 'cal-numero', String(dia.getDate())),
      doDia.length ? el('ul', 'cal-itens', doDia.map((c) => el('li', null, itemDaGrade(c)))) : null);
    celula.setAttribute('role', 'cell');
    if (dia.getMonth() !== mes.getMonth()) celula.classList.add('fora-do-mes');
    if (mesmoDia(dia, hoje)) {
      celula.classList.add('hoje');
      celula.setAttribute('aria-current', 'date');
    }
    celula.setAttribute('aria-label', dia.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
    semanas.at(-1).append(celula);
  }
  $('grade').replaceChildren(cabecalho, ...semanas);
}

function itemDaGrade(c) {
  const cliente = porId.get(c.cliente_id);
  const etapaAtual = etapa(c);
  const a = el('a', `cal-item situacao-${postado(c) ? 'postado' : c.status}`,
    el('span', 'cal-item-titulo', c.titulo),
    etapaAtual ? el('span', 'cal-item-etapa', etapaAtual) : null);
  a.href = `/admin/conteudo/?id=${c.id}`;
  a.style.setProperty('--cor', cliente?.cor ?? 'var(--espresso)');
  const partes = [cliente?.nome, FORMATOS[c.formato], SITUACOES[c.status].texto, etapaAtual && `Trello: ${etapaAtual}`].filter(Boolean);
  a.title = `${partes.join(' · ')}\n${c.titulo}`;
  a.setAttribute('aria-label', `${c.titulo}, ${partes.join(', ')}`);
  return a;
}

// Celular (e "Sem data"): uma linha por conteúdo, com cliente, formato e situação.
function itemDaLista(c) {
  const cliente = porId.get(c.cliente_id);
  const situacao = SITUACOES[c.status];
  const a = el('a', `cal-linha situacao-${postado(c) ? 'postado' : c.status}`,
    el('span', 'cal-cor'),
    el('span', 'cal-linha-info',
      el('span', 'cal-linha-titulo', c.titulo),
      el('span', 'cal-linha-meta', [cliente?.nome, FORMATOS[c.formato], etapa(c)].filter(Boolean).join(' · ')),
      c.conteudos_internos?.trello_aviso && !c.data_prevista
        ? el('span', 'cal-linha-aviso', c.conteudos_internos.trello_aviso) : null),
    el('span', `situacao ${postado(c) ? 'postado' : situacao.classe}`, postado(c) ? 'Postado' : situacao.texto));
  a.href = `/admin/conteudo/?id=${c.id}`;
  a.style.setProperty('--cor', cliente?.cor ?? 'var(--espresso)');
  return el('li', null, a);
}

function desenharLista(doMes) {
  const hoje = new Date();
  const porDia = agruparPorDia(doMes);
  $('lista-dias').replaceChildren(...[...porDia].map(([dia, itens]) => {
    const data = lerData(dia);
    const texto = data.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replaceAll('.', '');
    const rotulo = texto.charAt(0).toUpperCase() + texto.slice(1); // "Dom, 4 de out"
    const titulo = el('h2', 'cal-dia-titulo', mesmoDia(data, hoje) ? `Hoje, ${texto}` : rotulo);
    return el('li', mesmoDia(data, hoje) ? 'hoje' : null, titulo, el('ul', 'cal-itens', itens.map(itemDaLista)));
  }));
}
