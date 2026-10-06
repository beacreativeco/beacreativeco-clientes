// Página inicial do cliente: conteúdos liberados, agrupados pelo que ele precisa fazer.
import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina } from './ui.js';
import { FORMATOS, SITUACOES_CLIENTE, diaEMes, diaSemanaHora, dataHora } from './conteudos.js';

iniciarPagina('cliente', async ({ perfil }) => {
  document.getElementById('sair').addEventListener('click', sair);
  document.getElementById('saudacao').textContent = `Olá, ${perfil.cliente.nome}`;

  // O RLS já entrega só os conteúdos deste cliente que não são rascunho.
  const { data, error } = await supabase
    .from('conteudos')
    .select('id, titulo, formato, data_prevista, status, prazo_aprovacao, aprovado_em')
    .order('data_prevista', { ascending: true, nullsFirst: false })
    .order('criado_em', { ascending: true });
  if (error) throw error;

  const grupos = {
    // O prazo que vence primeiro fica em cima.
    em_aprovacao: data.filter((c) => c.status === 'em_aprovacao')
      .sort((a, b) => (a.prazo_aprovacao ?? '9').localeCompare(b.prazo_aprovacao ?? '9')),
    ajuste_solicitado: data.filter((c) => c.status === 'ajuste_solicitado'),
    // Aprovados: o mais recente primeiro.
    aprovado: data.filter((c) => c.status === 'aprovado').reverse(),
  };

  desenharGrupo('secao-aprovar', grupos.em_aprovacao);
  desenharGrupo('secao-ajuste', grupos.ajuste_solicitado);
  desenharGrupo('secao-aprovados', grupos.aprovado);
  document.getElementById('resumo').textContent = resumo(grupos.em_aprovacao.length, data.length);
});

function resumo(paraAprovar, total) {
  if (paraAprovar === 1) return 'Tem 1 conteúdo esperando sua aprovação.';
  if (paraAprovar > 1) return `Tem ${paraAprovar} conteúdos esperando sua aprovação.`;
  if (total) return 'Nada para aprovar agora. Quando a Bea enviar um conteúdo novo, ele aparece aqui.';
  return 'Ainda não tem conteúdo por aqui. Quando a Bea enviar o primeiro para você aprovar, ele aparece nesta página.';
}

function textoDaSituacao(c) {
  if (c.status === 'em_aprovacao' && c.prazo_aprovacao) {
    return new Date(c.prazo_aprovacao) < new Date()
      ? 'Prazo encerrado'
      : `Até ${diaSemanaHora(c.prazo_aprovacao)}`;
  }
  if (c.status === 'aprovado' && c.aprovado_em) return `✦ Aprovado em ${dataHora(c.aprovado_em).split(',')[0]}`;
  return SITUACOES_CLIENTE[c.status].texto;
}

function desenharGrupo(idSecao, conteudos) {
  const secao = document.getElementById(idSecao);
  secao.hidden = conteudos.length === 0;
  const modelo = document.getElementById('modelo-conteudo');

  secao.querySelector('.agenda').replaceChildren(...conteudos.map((c) => {
    const li = modelo.content.firstElementChild.cloneNode(true);
    const data = diaEMes(c.data_prevista);
    li.querySelector('.agenda-link').href = `/cliente/conteudo/?id=${c.id}`;
    li.querySelector('.agenda-dia').textContent = data ? data.dia : '–';
    li.querySelector('.agenda-mes').textContent = data ? data.mes : 'sem data';
    li.querySelector('.agenda-titulo').textContent = c.titulo;
    li.querySelector('.agenda-formato').textContent = FORMATOS[c.formato];
    const selo = li.querySelector('.situacao');
    selo.textContent = textoDaSituacao(c);
    selo.classList.add(SITUACOES_CLIENTE[c.status].classe);
    return li;
  }));
}
