// Um conteúdo visto pelo cliente: prévia estilo Instagram, aprovar ou pedir ajuste, histórico.
import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';
import { FORMATOS, SITUACOES_CLIENTE, lerData, diaSemanaHora, parametro } from './conteudos.js';
import { criarPrevia } from './previa-instagram.js';

const $ = (id) => document.getElementById(id);
let conteudo;
let cliente;

iniciarPagina('cliente', async ({ perfil }) => {
  $('sair').addEventListener('click', sair);
  const id = parametro('id');
  if (!id) return voltarParaLista();

  // RLS: só volta se o conteúdo for deste cliente e não for rascunho.
  const [c, cad] = await Promise.all([
    supabase.from('conteudos').select('*').eq('id', id).maybeSingle(),
    supabase.from('clientes').select('id, nome, instagram, foto_perfil').eq('id', perfil.cliente.id).maybeSingle(),
  ]);
  if (c.error) throw c.error;
  if (cad.error) throw cad.error;
  if (!c.data) return voltarParaLista();
  conteudo = c.data;
  cliente = cad.data;

  const [midias, mensagens] = await Promise.all([
    supabase.from('midias').select('id, tipo, arquivo_url, ordem')
      .eq('conteudo_id', id).eq('versao', conteudo.versao_atual).order('ordem'),
    carregarMensagens(),
  ]);
  if (midias.error) throw midias.error;

  criarPrevia($('previa')).atualizar({
    formato: conteudo.formato,
    midias: midias.data,
    legenda: conteudo.legenda ?? '',
    data: conteudo.data_prevista,
    cliente,
  });

  ligarDecisao();
  desenhar();
  desenharHistorico(mensagens);
});

function voltarParaLista() {
  window.location.replace('/cliente/');
}

async function carregarMensagens() {
  const { data, error } = await supabase.from('mensagens')
    .select('id, autor, tipo, texto, criado_em')
    .eq('conteudo_id', conteudo.id).order('criado_em');
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- tela

function desenhar() {
  document.title = `${conteudo.titulo} · BeaCreative`;
  $('titulo').textContent = conteudo.titulo;

  const situacao = $('situacao');
  situacao.className = `situacao ${SITUACOES_CLIENTE[conteudo.status].classe}`;
  situacao.textContent = SITUACOES_CLIENTE[conteudo.status].texto;

  const data = lerData(conteudo.data_prevista);
  $('detalhes').textContent = data
    ? `${FORMATOS[conteudo.formato]} para ${data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`
    : FORMATOS[conteudo.formato];

  const drive = $('drive');
  drive.hidden = !conteudo.drive_url;
  if (conteudo.drive_url) drive.href = conteudo.drive_url;

  const esperando = conteudo.status === 'em_aprovacao';
  $('decisao').hidden = !esperando;

  const prazo = $('prazo');
  prazo.hidden = !(esperando && conteudo.prazo_aprovacao);
  if (!prazo.hidden) {
    const vencido = new Date(conteudo.prazo_aprovacao) < new Date();
    prazo.textContent = vencido
      ? `O prazo para aprovar terminou em ${diaSemanaHora(conteudo.prazo_aprovacao)}. Você ainda pode aprovar ou pedir ajuste.`
      : `Aprove ou peça ajuste até ${diaSemanaHora(conteudo.prazo_aprovacao)}.`;
  }

  const resultado = $('resultado');
  resultado.hidden = esperando;
  if (conteudo.status === 'aprovado') {
    const quem = conteudo.aprovado_por === 'prazo' ? 'Aprovado pelo prazo' : 'Você aprovou';
    resultado.replaceChildren(el('span', 'cc-estrela', '✦'), ` ${quem} em ${diaSemanaHora(conteudo.aprovado_em)}.`);
  } else if (conteudo.status === 'ajuste_solicitado') {
    resultado.textContent = 'Você pediu ajuste. A Bea está preparando uma nova versão e avisa quando estiver pronta.';
  }
}

function el(tag, classe, texto) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texto != null) n.textContent = texto;
  return n;
}

function desenharHistorico(mensagens) {
  $('secao-historico').hidden = mensagens.length === 0;
  $('historico').replaceChildren(...mensagens.map((m) => {
    const li = el('li', `cc-mensagem cc-mensagem-${m.autor}`);
    const quem = m.autor === 'bea' ? 'Bea' : 'Você';
    const acao = m.tipo === 'aprovacao' ? `${quem} aprovou` : m.autor === 'bea' ? 'Bea escreveu' : 'Você pediu ajuste';
    li.append(
      el('p', 'cc-mensagem-quem', `${acao} em ${diaSemanaHora(m.criado_em)}`),
      m.texto ? el('p', 'cc-mensagem-texto', m.texto) : '',
    );
    return li;
  }));
}

// ---------------------------------------------------------------- decisão

function ligarDecisao() {
  const aprovar = $('aprovar');
  const form = $('form-ajuste');
  const texto = $('texto-ajuste');

  // Aprovar não tem volta: pede um segundo toque, como o "Remover" do editor.
  let timer;
  aprovar.addEventListener('click', async () => {
    if (!aprovar.dataset.confirmar) {
      aprovar.dataset.confirmar = '1';
      aprovar.textContent = 'Confirmar aprovação';
      timer = setTimeout(() => {
        delete aprovar.dataset.confirmar;
        aprovar.textContent = '✦ Aprovado';
      }, 6000);
      return;
    }
    clearTimeout(timer);
    await decidir(aprovar, () => supabase.rpc('aprovar_conteudo', { p_conteudo_id: conteudo.id }), 'Conteúdo aprovado.');
  });

  $('abrir-ajuste').addEventListener('click', () => {
    form.hidden = false;
    $('decisao').classList.add('escrevendo');
    texto.focus();
  });
  $('cancelar-ajuste').addEventListener('click', () => {
    form.hidden = true;
    $('decisao').classList.remove('escrevendo');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!texto.value.trim()) {
      mostrarErro('Escreva o que você quer mudar.');
      texto.focus();
      return;
    }
    await decidir($('enviar-ajuste'),
      () => supabase.rpc('pedir_ajuste', { p_conteudo_id: conteudo.id, p_texto: texto.value }),
      'Pedido de ajuste enviado para a Bea.');
  });
}

async function decidir(botao, chamada, sucesso) {
  $('aviso').hidden = true;
  botao.disabled = true;
  const { data, error } = await chamada();
  botao.disabled = false;
  if (error) {
    console.error(error);
    // Mensagens das funções do banco já vêm prontas para o cliente (P0001).
    mostrarErro(error.code === 'P0001' ? error.message : 'Não foi possível enviar agora. Confira sua internet e tente de novo.');
    return;
  }
  conteudo = data;
  desenhar();
  desenharHistorico(await carregarMensagens());
  if (conteudo.status === 'aprovado') $('resultado').classList.add('acabou-de-aprovar');
  avisar(sucesso);
}

function mostrarErro(texto) {
  const aviso = $('aviso');
  aviso.textContent = texto;
  aviso.hidden = false;
}
