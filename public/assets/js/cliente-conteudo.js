// Um conteúdo visto pelo cliente: prévia estilo Instagram, aprovar ou pedir ajuste, histórico.
import { supabase, chamarServidor } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar, montarTrilha } from './ui.js';
import { FORMATOS, SITUACOES_CLIENTE, lerData, diaSemanaHora, parametro } from './conteudos.js';
import { criarPrevia } from './previa-instagram.js';
import { criarConversa } from './conversa.js';

const $ = (id) => document.getElementById(id);
let conteudo;
let cliente;
let conversa;

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

  const [midias, bea] = await Promise.all([
    supabase.from('midias').select('id, tipo, arquivo_url, ordem, expira_em')
      .eq('conteudo_id', id).eq('versao', conteudo.versao_atual).order('ordem'),
    // Nome e foto da Bea nos balões dela. Se falhar, a conversa mostra só "Bea".
    supabase.rpc('perfil_bea').maybeSingle(),
  ]);
  if (midias.error) throw midias.error;
  if (bea.error) console.error(bea.error);

  criarPrevia($('previa')).atualizar({
    formato: conteudo.formato,
    midias: midias.data,
    legenda: conteudo.legenda ?? '',
    data: conteudo.data_prevista,
    cliente,
    drive: conteudo.drive_url ?? '',
  });

  // "Pedir ajuste" abre a conversa: a próxima mensagem do cliente vira o pedido.
  conversa = criarConversa($('conversa'), {
    clienteId: cliente.id,
    conteudoId: conteudo.id,
    eu: 'cliente',
    perfilDoOutro: bea.data ?? null,
    pedirAjuste: async (mensagem) => {
      const { data, error } = await supabase.rpc('pedir_ajuste', {
        p_conteudo_id: conteudo.id,
        p_tipo: mensagem.tipo,
        p_texto: mensagem.texto ?? null,
        p_arquivo_url: mensagem.arquivo_url ?? null,
        p_duracao_s: mensagem.duracao_s ?? null,
        p_onda: mensagem.onda ?? null,
      });
      if (error) throw error;
      conteudo = data;
      desenhar();
      avisar('Pedido de ajuste enviado para a Bea.');
      organizarDepois(conteudo.id);
    },
  });
  await conversa.carregar();

  ligarDecisao();
  desenhar();
});

function voltarParaLista() {
  window.location.replace('/cliente/');
}

// ---------------------------------------------------------------- tela

function desenhar() {
  document.title = `${conteudo.titulo} · BeaCreative`;
  $('titulo').textContent = conteudo.titulo;
  const aprovado = conteudo.status === 'aprovado';
  montarTrilha([
    { texto: aprovado ? 'Aprovados' : 'Para aprovar', href: aprovado ? '/cliente/?ver=aprovados' : '/cliente/' },
    { texto: conteudo.titulo },
  ]);

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

// ---------------------------------------------------------------- decisão

function ligarDecisao() {
  const aprovar = $('aprovar');

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

  $('abrir-ajuste').addEventListener('click', () => conversa.pedirAjuste());
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
  conversa.sairDoModoAjuste();
  desenhar();
  if (conteudo.status === 'aprovado') $('resultado').classList.add('acabou-de-aprovar');
  avisar(sucesso);
  organizarDepois(conteudo.id);
}

// Depois de mudar a situação, o servidor acerta o que fica fora do banco: a pasta dos arquivos
// no armazenamento (ex.: aprovados/, apagados 30 dias depois) e o cartão do Trello. Não trava a
// tela: se falhar, a ação no sistema já valeu e a próxima chamada acerta o resto.
function organizarDepois(id) {
  chamarServidor('/api/conteudo/organizar', { metodo: 'POST', corpo: { conteudo_id: id } }).catch(console.error);
}


function mostrarErro(texto) {
  const aviso = $('aviso');
  aviso.textContent = texto;
  aviso.hidden = false;
}
