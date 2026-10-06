// Trello: chamadas à API (chave + token da conta da Bea, só no servidor) e a leitura
// dos cartões no padrão combinado: "13/10 · Reels · Título" (data e formato no título,
// como no quadro do Casa Coelho; a "Data de entrega" do Trello fica livre para a Bea).

const API = 'https://api.trello.com/1';

export function trelloConfigurado(env) {
  return Boolean(env.TRELLO_API_KEY && env.TRELLO_TOKEN);
}

export async function trello(env, caminho, { metodo = 'GET', params = {} } = {}) {
  const url = new URL(`${API}${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', env.TRELLO_API_KEY);
  url.searchParams.set('token', env.TRELLO_TOKEN);
  const resp = await fetch(url, { method: metodo });
  if (!resp.ok) {
    console.error('trello', metodo, caminho, resp.status, await resp.text());
    throw new Error(resp.status === 401 ? 'O acesso ao Trello foi recusado (token revogado?).' : 'Falha ao falar com o Trello.');
  }
  return resp.json();
}

// Listas que têm entregas: "[FEED] semana um", "Semana 2", "conteúdos extras".
// Ficam de fora "estratégia", "ideias", "manual de marca" e as divisórias de mês.
export const LISTA_DE_ENTREGAS = /\[feed\]|\bsemana\b|\bextras?\b/i;

// Etapas da produção (etiquetas do Trello), da primeira à última.
export const ETAPAS = [
  'GRAVAR', 'GRAVADO', 'CRIAR ARTE', 'EDITAR', 'MATERIAL VISUAL OK',
  'AGUARDANDO APROVAÇÃO', 'APROVADO', 'PROGRAMAR', 'PROGRAMADO', 'POSTADO',
];

// O número de sequência que a Bea às vezes põe junto ("reel 4", "carrossel 3") é ignorado.
const FORMATOS = [
  [/^reels?(\s+\d+)?$/i, 'reels'],
  [/^(carross[eé]l|carousel)(\s+\d+)?$/i, 'carrossel'],
  [/^(stor(y|ies)|storie)(\s+\d+)?$/i, 'story'],
  [/^(post|foto|est[áa]tico|arte|feed)(\s+\d+)?$/i, 'post'],
];
const DIA_DA_SEMANA = /^(dom|seg|ter|qua|qui|sex|s[áa]b)\.?$/i;
const DATA = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;
const SEPARADORES = /\s+[·|•–—-]\s+|\s*·\s*/;

// Espaços invisíveis que a Bea usa nos cartões separadores.
const limpar = (texto) => texto.replace(/[​-‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim();

/** Cartão separador de semana (sem título, ou só "."). */
export function ehSeparador(nome) {
  return /^[.\s·-]*$/.test(limpar(nome));
}

// Ano da data "dd/mm" sem ano: o que deixa a data mais perto de hoje.
function comAno(dia, mes, hoje) {
  const candidatos = [-1, 0, 1].map((d) => new Date(hoje.getFullYear() + d, mes - 1, dia));
  return candidatos.reduce((melhor, c) => (Math.abs(c - hoje) < Math.abs(melhor - hoje) ? c : melhor));
}

const isoDoDia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * "05 · ter 13/10 · Reels · O verão da pele começa agora" →
 * { data: '2026-10-13', formato: 'reels', titulo: 'O verão da pele começa agora', avisos: [] }
 * Também entende "Reels - FisioFort" (sem data: data null e um aviso).
 */
export function lerTitulo(nome, hoje = new Date()) {
  const original = limpar(nome);
  let data = null;
  let formato = null;
  const resto = [];

  for (let parte of original.split(SEPARADORES).map((p) => p.trim()).filter(Boolean)) {
    // "ter 13/10" vira "13/10"; o número de ordem ("05") no começo some.
    const palavras = parte.split(' ');
    if (palavras.length === 2 && DIA_DA_SEMANA.test(palavras[0]) && DATA.test(palavras[1])) parte = palavras[1];
    if (!resto.length && !data && !formato && /^\d{1,3}$/.test(parte)) continue;

    const d = DATA.exec(parte);
    if (d && !data) {
      const [dia, mes] = [Number(d[1]), Number(d[2])];
      if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
        const ano = d[3] ? Number(d[3].length === 2 ? `20${d[3]}` : d[3]) : null;
        data = isoDoDia(ano ? new Date(ano, mes - 1, dia) : comAno(dia, mes, hoje));
        continue;
      }
    }
    if (DIA_DA_SEMANA.test(parte)) continue;
    const f = FORMATOS.find(([re]) => re.test(parte));
    if (f && !formato) {
      formato = f[1];
      continue;
    }
    resto.push(parte);
  }

  const avisos = [];
  if (!data) avisos.push('sem data no título do Trello');
  if (!formato) avisos.push('sem formato no título do Trello');
  return {
    data,
    formato: formato ?? 'post',
    titulo: resto.join(' · ') || original,
    avisos,
    // Sem data e sem formato não é entrega (ex.: "Roteiros Stories"): fica de fora, só no resumo.
    entrega: Boolean(data || formato),
  };
}

/** Etiquetas de etapa do cartão, na ordem da produção; a última é a etapa atual. */
export function etapasDoCartao(etiquetas) {
  const nomes = etiquetas.map((e) => limpar(e.name ?? '').toUpperCase()).filter(Boolean);
  return ETAPAS.filter((etapa) => nomes.includes(etapa));
}
