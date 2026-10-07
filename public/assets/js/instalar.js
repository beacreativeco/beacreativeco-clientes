// Instalar o sistema como app (PWA), no padrão do LAEG-BIO. Três caminhos, pelo navegador:
//   - 'prompt': Chrome/Edge (Android e computador) disparam beforeinstallprompt; o evento fica
//     guardado e "Instalar" chama o prompt() dele;
//   - 'ios-safari': iPhone/iPad no Safari não têm botão automático: o convite ensina
//     Compartilhar → "Adicionar à Tela de Início";
//   - 'ios-outro': Chrome/Firefox/Edge no iPhone não instalam: o convite orienta abrir no Safari.
// Fora disso (Firefox/Safari no computador) não há o que oferecer, e nada aparece.
// Já instalado (abrindo como app, ou appinstalled neste aparelho): nada também.
//
// O convite aparece sozinho alguns segundos depois de abrir uma página logada, uma vez por
// sessão. "Agora não" pausa 30 dias; "Não mostrar de novo" desliga o convite automático.
// "Instalar o sistema" no menu do avatar continua funcionando a qualquer momento.

const CHAVE_PAUSA = 'bea-convite-instalar-pausado';     // data (ms) do último "Agora não"
const CHAVE_NUNCA = 'bea-convite-instalar-nunca';       // '1' = "Não mostrar de novo"
const CHAVE_INSTALADO = 'bea-app-instalado';            // '1' = appinstalled neste aparelho
const CHAVE_SESSAO = 'bea-convite-instalar-mostrado';   // sessionStorage
const PAUSA_DIAS = 30;
const ATRASO_MS = 6000; // nunca junto com o carregamento da página

let eventoInstalar = null; // beforeinstallprompt guardado
let cartao = null;

// Em modo privado (ou com o armazenamento bloqueado) só não lembra; o convite segue funcionando.
function ler(armazenamento, chave) {
  try { return armazenamento.getItem(chave); } catch { return null; }
}
function gravar(armazenamento, chave, valor) {
  try { armazenamento.setItem(chave, valor); } catch { /* sem armazenamento */ }
}

export function jaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// iPadOS se apresenta como Mac; o toque denuncia.
export function ehIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Como dá para instalar aqui ('prompt', 'ios-safari', 'ios-outro'), ou null. */
export function modoInstalacao() {
  if (jaInstalado() || ler(localStorage, CHAVE_INSTALADO) === '1') return null;
  if (eventoInstalar) return 'prompt';
  if (ehIos()) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(navigator.userAgent) ? 'ios-outro' : 'ios-safari';
  return null;
}

// O item do menu do avatar aparece e some junto com a possibilidade de instalar.
function avisarMudanca() {
  window.dispatchEvent(new CustomEvent('instalacao-mudou', { detail: { pode: Boolean(modoInstalacao()) } }));
}

function el(tag, classe, ...filhos) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  no.append(...filhos.filter((f) => f != null));
  return no;
}

function botao(texto, classe) {
  const b = el('button', classe, texto);
  b.type = 'button';
  return b;
}

// Ícone de Compartilhar do iPhone (quadrado com seta para cima), desenhado por nós.
function iconeCompartilhar() {
  const span = el('span', 'convite-icone-compartilhar');
  span.setAttribute('role', 'img');
  span.setAttribute('aria-label', 'Compartilhar');
  // String fixa deste arquivo (nunca dado de usuário).
  span.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8v8.4M5.3 4.4 8 1.8l2.7 2.6"/><path d="M5.6 6.6H4.2a1 1 0 0 0-1 1v5.6a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V7.6a1 1 0 0 0-1-1h-1.4"/></svg>';
  return span;
}

function textoDoModo(modo) {
  const forte = (t) => el('strong', null, t);
  if (modo === 'ios-safari') {
    return el('p', 'convite-texto', 'Toque em ', iconeCompartilhar(), ' e depois em ', forte('“Adicionar à Tela de Início”'), '.');
  }
  if (modo === 'ios-outro') {
    return el('p', 'convite-texto', 'No iPhone, a instalação é pelo ', forte('Safari'), ': abra este endereço nele, toque em ',
      iconeCompartilhar(), ' e depois em ', forte('“Adicionar à Tela de Início”'), '.');
  }
  return el('p', 'convite-texto', 'Abra direto da tela inicial, como um aplicativo, sem procurar o endereço.');
}

function fecharConvite() {
  cartao?.remove();
  cartao = null;
}

function mostrarConvite(manual) {
  const modo = modoInstalacao();
  if (!modo) return false;
  fecharConvite();

  const instalar = botao('Instalar', 'botao botao-compacto');
  const agoraNao = botao('Agora não', 'botao-secundario botao-compacto');
  const nunca = botao('Não mostrar de novo', 'convite-nunca');
  const fechar = botao('×', 'convite-fechar');
  fechar.setAttribute('aria-label', 'Fechar');

  const icone = new Image();
  icone.src = '/apple-touch-icon.png';
  icone.alt = '';
  icone.className = 'convite-app-icone';

  cartao = el('section', 'convite-instalar',
    fechar,
    el('div', 'convite-topo', icone, el('h2', 'convite-titulo', 'Instale o sistema')),
    textoDoModo(modo),
    el('div', 'convite-acoes', modo === 'prompt' ? instalar : null, agoraNao),
    // Aberto pelo menu: a pessoa pediu, então não cabe "não mostrar de novo".
    manual ? null : nunca);
  cartao.setAttribute('role', 'dialog');
  cartao.setAttribute('aria-labelledby', 'convite-titulo');
  cartao.querySelector('.convite-titulo').id = 'convite-titulo';

  const pausar = () => { gravar(localStorage, CHAVE_PAUSA, String(Date.now())); fecharConvite(); };
  fechar.addEventListener('click', pausar);
  agoraNao.addEventListener('click', pausar);
  nunca.addEventListener('click', () => { gravar(localStorage, CHAVE_NUNCA, '1'); fecharConvite(); });
  instalar.addEventListener('click', instalarAgora);
  cartao.addEventListener('keydown', (e) => { if (e.key === 'Escape') pausar(); });

  document.body.append(cartao);
  gravar(sessionStorage, CHAVE_SESSAO, '1');
  if (manual) (modo === 'prompt' ? instalar : fechar).focus();
  return true;
}

// Sozinho, só se: há como instalar, não foi desligado, não apareceu nesta sessão e o
// último "Agora não" tem mais de 30 dias.
function talvezMostrar() {
  if (cartao || !modoInstalacao()) return;
  if (ler(localStorage, CHAVE_NUNCA) === '1') return;
  if (ler(sessionStorage, CHAVE_SESSAO) === '1') return;
  const pausadoEm = Number(ler(localStorage, CHAVE_PAUSA)) || 0;
  if (Date.now() - pausadoEm < PAUSA_DIAS * 24 * 60 * 60 * 1000) return;
  mostrarConvite(false);
}

/** "Instalar o sistema" (menu do avatar): o botão do navegador direto, ou o passo a passo. */
export async function instalarAgora() {
  if (!eventoInstalar) {
    mostrarConvite(true);
    return;
  }
  const evento = eventoInstalar;
  // O evento só pode ser usado uma vez: aceito ou não, descarta.
  eventoInstalar = null;
  fecharConvite();
  evento.prompt();
  await evento.userChoice.catch(() => null);
  avisarMudanca();
}

let liberado = false;

// Os eventos do navegador podem chegar a qualquer momento: escutar desde já.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  if (jaInstalado()) return;
  eventoInstalar = e;
  avisarMudanca();
  if (liberado) talvezMostrar(); // chegou depois do atraso
});
window.addEventListener('appinstalled', () => {
  eventoInstalar = null;
  gravar(localStorage, CHAVE_INSTALADO, '1');
  fecharConvite();
  avisarMudanca();
});

/** Chamado por ui.js quando a página logada aparece: registra o app e agenda o convite. */
export function iniciarInstalacao() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }
  avisarMudanca();
  setTimeout(() => {
    liberado = true;
    talvezMostrar();
  }, ATRASO_MS);
}
