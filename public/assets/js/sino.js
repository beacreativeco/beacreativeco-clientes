// Notificações à vista (Bea e cliente), montado por ui.js e pelo menu do perfil:
//   - sino no topo, ao lado da foto: pontinho enquanto não estiver ativado; depois, o número
//     de novidades. Tocar abre o painel com o convite (ou "Como liberar"/"Como instalar") e a
//     lista de novidades (mensagens não lidas; cliente: conteúdos esperando aprovação);
//   - faixa nas telas iniciais (/admin/ e /cliente/) enquanto não estiver ativado, com
//     "Agora não" que esconde por um dia;
//   - item "Notificações" no menu do perfil, com o status;
//   - janela "Como liberar" (permissão bloqueada), com o passo a passo deste aparelho.
// A seção completa (testar, desligar, aparelhos) continua no Meu perfil.
import { supabase } from './supabase.js';
import { avisar } from './ui.js';
import { situacaoNesteAparelho, ativar } from './notificacoes.js';
import { jaInstalado, ehIos, instalarAgora } from './instalar.js';

const CHAVE_FAIXA = 'bea-faixa-notificacoes-ate'; // até quando (ms) o "Agora não" esconde a faixa
const UM_DIA = 24 * 60 * 60 * 1000;

function el(tag, classe, ...filhos) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) no.append(f);
  return no;
}

function botao(texto, classe) {
  const b = el('button', classe, texto);
  b.type = 'button';
  return b;
}

const ICONE_SINO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';

let area = 'cliente';

// ---------------------------------------------------------------- ações comuns

/** Ativa (toque da pessoa) e avisa o resultado. */
async function ativarAgora() {
  try {
    await ativar();
    avisar('Notificações ativadas neste aparelho.');
  } catch (err) {
    console.error(err);
    if ((await situacaoNesteAparelho()) === 'bloqueado') abrirComoLiberar();
    else avisar(err.code === 'P0001' ? err.message : 'Não foi possível ativar agora. Tente de novo.', 'erro');
  }
}

/** Passo a passo para liberar a permissão bloqueada, pelo aparelho e navegador em uso. */
export function passosParaLiberar() {
  const ua = navigator.userAgent;
  const site = location.host;
  if (ehIos()) {
    return [
      'Abra os Ajustes do iPhone (ou do iPad).',
      'Toque em Notificações e procure “BeaCreative” na lista.',
      'Ligue “Permitir Notificações”.',
    ];
  }
  if (/Android/.test(ua)) {
    return jaInstalado()
      ? [
        'Na tela inicial, toque e segure o ícone do BeaCreative e toque em “Informações do app” (ⓘ).',
        'Toque em Notificações e ligue “Mostrar notificações”.',
      ]
      : [
        `Toque no ícone à esquerda do endereço (${site}) e depois em “Permissões” ou “Configurações do site”.`,
        'Em Notificações, escolha “Permitir”.',
      ];
  }
  if (/Firefox/.test(ua)) {
    return [
      `Clique no ícone à esquerda do endereço (${site}).`,
      'Em Permissões, tire o bloqueio de “Enviar notificações” (clique no ×).',
    ];
  }
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) {
    return [
      'No menu Safari, abra Ajustes e vá na aba Sites.',
      `Em Notificações, ache ${site} e escolha “Permitir”.`,
    ];
  }
  // Chrome e Edge no computador (também com o sistema instalado).
  return [
    `Clique no ícone à esquerda do endereço (${site}). No sistema instalado, ele fica na barra de cima da janela.`,
    'Em Notificações, escolha “Permitir”.',
  ];
}

let janelaLiberar;
/** Janela "Como liberar", no padrão das janelas do sistema. */
export function abrirComoLiberar() {
  janelaLiberar?.remove();
  const fechar = botao('×', 'botao-fechar');
  fechar.setAttribute('aria-label', 'Fechar');
  const jaLiberei = botao('Já liberei', 'botao botao-compacto');
  const agoraNao = botao('Fechar', 'botao-secundario botao-compacto');
  janelaLiberar = el('dialog', 'dialogo dialogo-pequeno',
    el('header', 'dialogo-topo',
      el('span', 'dialogo-inicial', '✦'),
      el('div', 'dialogo-titulos',
        el('h2', null, 'Liberar as notificações'),
        el('p', 'dialogo-subtitulo', 'Elas estão bloqueadas neste navegador. Só você consegue liberar.')),
      fechar),
    el('div', 'dialogo-corpo',
      el('ol', 'liberar-passos', ...passosParaLiberar().map((p) => el('li', null, p))),
      el('p', 'dica', 'Depois, volte aqui e toque em “Já liberei”.')),
    el('div', 'dialogo-rodape', agoraNao, jaLiberei));
  janelaLiberar.setAttribute('aria-label', 'Como liberar as notificações');
  document.body.append(janelaLiberar);
  const sair = () => janelaLiberar.close();
  fechar.addEventListener('click', sair);
  agoraNao.addEventListener('click', sair);
  janelaLiberar.addEventListener('close', () => janelaLiberar.remove());
  jaLiberei.addEventListener('click', async () => {
    if (('Notification' in window) && Notification.permission === 'denied') {
      avisar('Ainda está bloqueado. Confira os passos; às vezes é preciso recarregar a página depois de liberar.', 'erro');
      return;
    }
    sair();
    await ativarAgora();
  });
  janelaLiberar.showModal();
}

// O que cada situação oferece (no painel do sino, na faixa e no menu).
const OFERTA = {
  'pode-ativar': {
    texto: 'Ative as notificações para saber na hora quando chegar conteúdo ou mensagem.',
    acao: 'Ativar notificações', curta: 'Ativar', fazer: ativarAgora,
  },
  bloqueado: {
    texto: 'As notificações estão bloqueadas neste navegador.',
    acao: 'Como liberar', curta: 'Como liberar', fazer: abrirComoLiberar,
  },
  'instalar-iphone': {
    texto: 'No iPhone, as notificações chegam com o sistema instalado na tela de início.',
    acao: 'Como instalar', curta: 'Como instalar', fazer: instalarAgora,
  },
};

// ---------------------------------------------------------------- novidades

/** Mensagens não lidas e (cliente) conteúdos esperando aprovação. */
async function carregarNovidades() {
  if (area === 'admin') {
    const { data, error } = await supabase.rpc('conversas_por_cliente');
    if (error) throw error;
    const itens = data.filter((c) => c.nao_lidas > 0).map((c) => ({
      titulo: c.cliente_nome,
      detalhe: c.tipo === 'aprovacao' && c.conteudo_titulo ? `✦ Aprovou “${c.conteudo_titulo}”`
        : c.pedido_ajuste && c.conteudo_titulo ? `Pediu ajuste em “${c.conteudo_titulo}”`
          : `${c.nao_lidas} ${c.nao_lidas === 1 ? 'mensagem nova' : 'mensagens novas'}`,
      href: `/admin/mensagens/?cliente=${c.cliente_id}`,
    }));
    return { itens, total: data.reduce((soma, c) => soma + c.nao_lidas, 0), mais: '/admin/mensagens/' };
  }
  const [naoLidas, esperando] = await Promise.all([
    supabase.rpc('conversas_nao_lidas'),
    supabase.from('conteudos').select('id, titulo, prazo_aprovacao').eq('status', 'em_aprovacao')
      .order('prazo_aprovacao', { ascending: true, nullsFirst: false }),
  ]);
  if (naoLidas.error) throw naoLidas.error;
  if (esperando.error) throw esperando.error;
  const mensagens = naoLidas.data.reduce((soma, c) => soma + c.quantidade, 0);
  const itens = [];
  if (mensagens) {
    itens.push({ titulo: 'BeaCreative', detalhe: `${mensagens} ${mensagens === 1 ? 'mensagem nova' : 'mensagens novas'}`, href: '/cliente/mensagens/' });
  }
  for (const c of esperando.data) {
    itens.push({ titulo: c.titulo, detalhe: 'Esperando sua aprovação', href: `/cliente/conteudo/?id=${c.id}` });
  }
  return { itens, total: mensagens + esperando.data.length, mais: '/cliente/mensagens/' };
}

// ---------------------------------------------------------------- sino

export function montarSino(qualArea) {
  area = qualArea;
  const topo = document.querySelector('.topo');
  if (!topo || topo.querySelector('.sino')) return;

  const sino = el('button', 'sino-botao');
  sino.type = 'button';
  sino.setAttribute('aria-haspopup', 'dialog');
  sino.setAttribute('aria-expanded', 'false');
  sino.innerHTML = ICONE_SINO; // desenho fixo deste arquivo (nunca dado de usuário)
  const marca = el('span', 'sino-marca');
  marca.hidden = true;
  sino.append(marca);

  const oferta = el('div', 'sino-oferta');
  const lista = el('ul', 'sino-lista');
  const vazio = el('p', 'sino-vazio', 'Nada novo por aqui.');
  const verTudo = el('a', 'sino-mais', 'Ver mensagens ›');
  const painel = el('div', 'sino-painel', el('h2', 'sino-titulo', 'Novidades'), oferta, lista, vazio, verTudo);
  painel.id = 'sino-painel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-label', 'Notificações e novidades');
  painel.hidden = true;
  sino.setAttribute('aria-controls', painel.id);

  const caixa = el('div', 'sino', sino, painel);
  const avatar = topo.querySelector('.perfil-menu') ?? topo.querySelector('#sair');
  if (avatar) avatar.before(caixa);
  else topo.append(caixa);

  let situacao = 'sem-suporte';
  async function desenhar() {
    situacao = await situacaoNesteAparelho().catch(() => 'sem-suporte');
    const o = OFERTA[situacao];
    oferta.hidden = !o;
    if (o) {
      const b = botao(o.acao, 'botao botao-compacto');
      b.addEventListener('click', () => { fechar(); o.fazer(); });
      oferta.replaceChildren(el('p', null, o.texto), b);
    }

    let novidades = { itens: [], total: 0, mais: area === 'admin' ? '/admin/mensagens/' : '/cliente/mensagens/' };
    try {
      novidades = await carregarNovidades();
    } catch (err) {
      console.error(err);
    }
    lista.replaceChildren(...novidades.itens.map((i) => {
      const a = el('a', 'sino-item', el('strong', null, i.titulo), el('span', null, i.detalhe));
      a.href = i.href;
      return el('li', null, a);
    }));
    vazio.hidden = novidades.itens.length > 0;
    verTudo.href = novidades.mais;

    // Sem ativar: pontinho de alerta. Ativado (ou sem como ativar): o número de novidades.
    const alerta = Boolean(o);
    marca.hidden = !alerta && novidades.total === 0;
    marca.classList.toggle('sino-ponto', alerta);
    marca.textContent = alerta ? '' : novidades.total > 99 ? '99+' : String(novidades.total);
    const partes = [];
    if (alerta) partes.push(situacao === 'bloqueado' ? 'notificações bloqueadas' : 'notificações desativadas');
    if (novidades.total) partes.push(`${novidades.total} ${novidades.total === 1 ? 'novidade' : 'novidades'}`);
    sino.setAttribute('aria-label', `Notificações${partes.length ? `: ${partes.join(', ')}` : ''}`);
  }

  function abrir() {
    painel.hidden = false;
    sino.setAttribute('aria-expanded', 'true');
    desenhar().catch(console.error);
    (painel.querySelector('button, a') ?? painel).focus?.();
  }
  function fechar(voltarFoco = false) {
    if (painel.hidden) return;
    painel.hidden = true;
    sino.setAttribute('aria-expanded', 'false');
    if (voltarFoco) sino.focus();
  }
  sino.addEventListener('click', () => (painel.hidden ? abrir() : fechar()));
  document.addEventListener('click', (e) => { if (!caixa.contains(e.target)) fechar(); });
  painel.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(true); });

  // Recontam: mensagem nova ou lida (avisos-admin.js / avisos-cliente.js), ativar ou
  // desligar, e a volta para a aba (a pessoa pode ter liberado a permissão no navegador).
  const redesenhar = () => desenhar().catch(console.error);
  for (const evento of ['mensagens-mudaram', 'conversa-lida', 'notificacoes-mudaram']) window.addEventListener(evento, redesenhar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) redesenhar(); });
  redesenhar();
}

// ---------------------------------------------------------------- faixa (telas iniciais)

function lerAte() {
  try { return Number(localStorage.getItem(CHAVE_FAIXA)) || 0; } catch { return 0; }
}

export function montarFaixa(qualArea) {
  area = qualArea;
  const main = document.querySelector('#app main');
  if (!main || main.querySelector('.faixa-notificacoes')) return;
  const faixa = el('div', 'faixa-notificacoes');
  faixa.setAttribute('role', 'region');
  faixa.setAttribute('aria-label', 'Notificações');
  faixa.hidden = true;
  main.prepend(faixa);

  async function desenhar() {
    const situacao = await situacaoNesteAparelho().catch(() => 'sem-suporte');
    const o = OFERTA[situacao];
    faixa.hidden = !o || Date.now() < lerAte();
    if (faixa.hidden) return;
    const fazer = botao(o.curta, 'botao botao-compacto');
    fazer.addEventListener('click', () => o.fazer());
    const agoraNao = botao('Agora não', 'botao-link');
    agoraNao.addEventListener('click', () => {
      try { localStorage.setItem(CHAVE_FAIXA, String(Date.now() + UM_DIA)); } catch { /* sem armazenamento: só some agora */ }
      faixa.hidden = true;
    });
    const sinoIcone = el('span', 'faixa-notificacoes-icone');
    sinoIcone.innerHTML = ICONE_SINO; // desenho fixo deste arquivo
    faixa.replaceChildren(sinoIcone, el('p', null, o.texto), el('div', 'faixa-notificacoes-acoes', fazer, agoraNao));
  }
  const redesenhar = () => desenhar().catch(console.error);
  window.addEventListener('notificacoes-mudaram', redesenhar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) redesenhar(); });
  redesenhar();
}

// ---------------------------------------------------------------- item do menu do perfil

/**
 * "Notificações" no menu do perfil, com o status à direita ("Ativadas ✓", "Ativar",
 * "Bloqueadas", "Instalar"). Some onde o navegador não recebe notificações.
 * @param {() => void} fecharMenu
 * @param {string} linkPerfil   Meu perfil desta área (Bea ou cliente)
 */
export function itemNotificacoes(fecharMenu, linkPerfil) {
  const status = el('span', 'perfil-item-status');
  const item = el('button', 'perfil-item perfil-item-notificacoes', el('span', null, 'Notificações'), status);
  item.type = 'button';
  item.setAttribute('role', 'menuitem');
  item.hidden = true;
  let situacao = 'sem-suporte';

  async function desenhar() {
    situacao = await situacaoNesteAparelho().catch(() => 'sem-suporte');
    item.hidden = situacao === 'sem-suporte';
    const textos = { ativo: 'Ativadas ✓', 'pode-ativar': 'Ativar', bloqueado: 'Como liberar', 'instalar-iphone': 'Instalar' };
    status.textContent = textos[situacao] ?? '';
    status.classList.toggle('perfil-item-status-ok', situacao === 'ativo');
  }
  item.addEventListener('click', () => {
    fecharMenu();
    if (situacao === 'ativo') window.location.href = `${linkPerfil}#notificacoes`;
    else OFERTA[situacao]?.fazer();
  });
  window.addEventListener('notificacoes-mudaram', () => desenhar().catch(console.error));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) desenhar().catch(console.error); });
  desenhar().catch(console.error);
  return item;
}
