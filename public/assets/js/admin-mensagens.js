// Aba Mensagens da Bea: uma conversa por cliente. Computador: lista à esquerda e conversa à
// direita. Celular: a lista é a página e a conversa abre em tela cheia (?cliente=<id>).
// Com &conteudo=<id>, só a parte da conversa sobre aquele conteúdo ("Ver tudo" volta).
import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';
import { situacaoNesteAparelho, ativar } from './notificacoes.js';
import { criarConversa, acompanharTeclado } from './conversa.js';

const $ = (id) => document.getElementById(id);
let conversas = [];   // linhas de conversas_por_cliente()
let aberta = null;    // { clienteId, conteudoId, conversa }
let aberturas = 0;    // trocar de cliente no meio do carregamento: vale a última escolha

iniciarPagina('admin', async () => {
  $('sair').addEventListener('click', sair);
  ligarNotificacoes().catch(console.error);
  acompanharTeclado();
  $('busca').addEventListener('input', desenharLista);

  await carregarLista();
  await abrirDoEndereco();

  // avisos-admin.js reconta a cada mensagem nova: a lista acompanha.
  window.addEventListener('mensagens-mudaram', () => carregarLista().catch(console.error));
  window.addEventListener('popstate', () => abrirDoEndereco().catch(console.error));

  // Voltar (celular): se a conversa foi aberta pela lista, ou veio da tela do conteúdo
  // ("Conversar sobre este conteúdo"), volta no histórico.
  document.querySelector('.mensagens-voltar').addEventListener('click', (e) => {
    e.preventDefault();
    const veioDoConteudo = aberta?.conteudoId && document.referrer.startsWith(`${location.origin}/admin/conteudo/`);
    if (history.state?.daLista || veioDoConteudo) history.back();
    else {
      history.replaceState(null, '', '/admin/mensagens/');
      abrir(null);
    }
  });
});

// ---------------------------------------------------------------- lista

async function carregarLista() {
  const { data, error } = await supabase.rpc('conversas_por_cliente');
  if (error) throw error;
  conversas = data;
  const naoLidas = data.reduce((soma, c) => soma + c.nao_lidas, 0);
  $('resumo').textContent = naoLidas === 0
    ? 'Tudo lido.'
    : `${naoLidas} ${naoLidas === 1 ? 'mensagem nova' : 'mensagens novas'}.`;
  desenharLista();
}

function desenharLista() {
  const busca = normalizar($('busca').value);
  const visiveis = conversas.filter((c) => normalizar(c.cliente_nome).includes(busca));
  $('conversas-vazia').hidden = visiveis.length > 0;
  $('conversas-vazia').textContent = conversas.length ? 'Nenhum cliente com esse nome.' : 'Nenhum cliente cadastrado ainda.';

  const modelo = $('modelo-conversa');
  $('conversas').replaceChildren(...visiveis.map((c) => {
    const li = modelo.content.firstElementChild.cloneNode(true);
    const a = li.querySelector('.conversa-item');
    a.href = `/admin/mensagens/?cliente=${c.cliente_id}`;
    a.dataset.cliente = c.cliente_id;
    if (aberta?.clienteId === c.cliente_id) a.setAttribute('aria-current', 'true');
    a.classList.toggle('tem-novas', c.nao_lidas > 0);
    preencherFoto(a.querySelector('.conversa-foto'), c.foto_url, c.cliente_nome);
    a.querySelector('.conversa-nome').textContent = c.cliente_nome;
    a.querySelector('.conversa-quando').textContent = c.criado_em ? quando(c.criado_em) : '';
    a.querySelector('.conversa-previa').textContent = previa(c);
    const badge = a.querySelector('.nao-lidas');
    badge.hidden = c.nao_lidas === 0;
    badge.textContent = String(c.nao_lidas);
    badge.setAttribute('aria-label', `${c.nao_lidas} ${c.nao_lidas === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`);
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; // abrir em outra aba
      e.preventDefault();
      if (aberta?.clienteId === c.cliente_id && !aberta.conteudoId) return;
      history.pushState({ daLista: true }, '', a.href);
      abrir(c.cliente_id);
    });
    return li;
  }));
}

function previa(c) {
  if (!c.criado_em) return 'Nenhuma mensagem ainda';
  const voce = c.autor === 'bea' ? 'Você: ' : '';
  if (c.apagada) return `${voce}Mensagem apagada`;
  if (c.tipo === 'aprovacao') return `✦ Aprovou${c.conteudo_titulo ? ` “${c.conteudo_titulo}”` : ''}`;
  const corpo = c.tipo === 'audio' ? 'Áudio' : c.tipo === 'referencia' ? `Imagem${c.texto ? `: ${c.texto}` : ''}` : c.texto ?? '';
  return c.pedido_ajuste ? `Pediu ajuste: ${corpo}` : `${voce}${corpo}`;
}

// ---------------------------------------------------------------- conversa

function abrirDoEndereco() {
  const busca = new URLSearchParams(location.search);
  return abrir(busca.get('cliente'), busca.get('conteudo'));
}

async function abrir(clienteId, conteudoId = null) {
  if (aberta?.clienteId === clienteId && aberta.conteudoId === conteudoId) return;
  aberta?.conversa.fechar();
  aberta = null;
  const vez = ++aberturas;

  const linha = clienteId && conversas.find((c) => c.cliente_id === clienteId);
  document.body.classList.toggle('conversa-aberta', Boolean(linha));
  $('conversa-cab').hidden = !linha;
  $('conversa').hidden = !linha;
  $('conversa-escolha').hidden = Boolean(linha);
  document.title = linha ? `${linha.cliente_nome} · Mensagens · BeaCreative` : 'Mensagens · BeaCreative';
  desenharLista();
  if (!linha) {
    $('conversa').replaceChildren();
    return;
  }

  preencherFoto($('conversa-foto'), linha.foto_url, linha.cliente_nome);
  $('conversa-nome').textContent = linha.cliente_nome;
  $('conversa-sub').textContent = '';
  $('conversa-cliente').href = `/admin/cliente/?id=${clienteId}`;

  const [cadastro, situacoes] = await Promise.all([
    supabase.from('clientes').select('nome, contato_nome, contato_foto_url').eq('id', clienteId).single(),
    supabase.from('conteudos').select('status').eq('cliente_id', clienteId).in('status', ['em_aprovacao', 'ajuste_solicitado']),
  ]);
  if (vez !== aberturas) return;
  if (cadastro.error) throw cadastro.error;
  if (!situacoes.error) $('conversa-sub').textContent = resumoDoCliente(situacoes.data);

  const conversa = criarConversa($('conversa'), {
    clienteId,
    conteudoId,
    eu: 'bea',
    tela: true,
    linkDoConteudo: (id) => `/admin/conteudo/?id=${id}`,
    // Nome e foto de quem aprova (Meu perfil do cliente); sem nome, o do cadastro.
    perfilDoOutro: { nome: cadastro.data.contato_nome || cadastro.data.nome, foto_url: cadastro.data.contato_foto_url },
    aoVerTudo: () => {
      history.pushState({ daLista: history.state?.daLista }, '', `/admin/mensagens/?cliente=${clienteId}`);
      abrir(clienteId).catch(console.error);
    },
  });
  aberta = { clienteId, conteudoId, conversa };
  await conversa.carregar();
}

function resumoDoCliente(conteudos) {
  const esperando = conteudos.filter((c) => c.status === 'em_aprovacao').length;
  const ajuste = conteudos.length - esperando;
  const partes = [];
  if (esperando) partes.push(`${esperando} esperando aprovação`);
  if (ajuste) partes.push(`${ajuste} em ajuste`);
  return partes.join(' · ') || 'Nada esperando aprovação';
}

// ---------------------------------------------------------------- utilidades

const normalizar = (t) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Foto (ou logo) do cliente; sem foto, ou se ela não abrir, as iniciais.
function preencherFoto(caixa, url, nome) {
  const iniciais = (nome ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '✦';
  caixa.replaceChildren(iniciais);
  caixa.setAttribute('aria-hidden', 'true');
  if (!url) return;
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  img.addEventListener('load', () => caixa.replaceChildren(img), { once: true });
}

function quando(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// "Ativar notificações": push de verdade (chega com o sistema fechado). A permissão só é
// pedida neste toque. Ativado (ou ativável só pelo perfil, como no iPhone sem instalar):
// o botão some e a explicação fica na seção Notificações do Meu perfil.
async function ligarNotificacoes() {
  const botao = $('ativar-notificacoes');
  const info = $('notificacoes-info');
  const mostrar = async () => {
    const situacao = await situacaoNesteAparelho();
    botao.hidden = situacao !== 'pode-ativar';
    info.hidden = situacao !== 'bloqueado';
    info.textContent = 'As notificações estão bloqueadas neste navegador. Para liberar, use o cadeado ao lado do endereço do site.';
  };
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    try {
      await ativar();
      avisar('Notificações ativadas. Para testar ou desligar, vá em Meu perfil.');
    } catch (err) {
      console.error(err);
      avisar(err.code === 'P0001' ? err.message : 'Não foi possível ativar agora. Tente de novo.', 'erro');
    } finally {
      botao.disabled = false;
      await mostrar();
    }
  });
  await mostrar();
}
