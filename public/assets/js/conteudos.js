// Vocabulário compartilhado dos conteúdos (rótulos, formatos, datas).

export const FORMATOS = {
  post: 'Post',
  carrossel: 'Carrossel',
  story: 'Story',
  reels: 'Reels',
};

// Como a Bea lê cada situação no painel.
export const SITUACOES = {
  rascunho: { texto: 'Rascunho', classe: 'rascunho' },
  em_aprovacao: { texto: 'Aguardando cliente', classe: 'aguardando' },
  ajuste_solicitado: { texto: 'Pediu ajuste', classe: 'ajuste' },
  aprovado: { texto: '✦ Aprovado', classe: 'aprovado' },
};

export const LIMITE_LEGENDA = 2200; // limite do Instagram

// "2026-10-14" vira Date local (sem o fuso empurrar para o dia anterior).
export function lerData(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function diaEMes(iso) {
  const data = lerData(iso);
  if (!data) return null;
  return {
    dia: String(data.getDate()),
    mes: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    semana: data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
  };
}

export function dataHora(isoTimestamp) {
  if (!isoTimestamp) return '';
  return new Date(isoTimestamp).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function parametro(nome) {
  return new URLSearchParams(window.location.search).get(nome);
}
