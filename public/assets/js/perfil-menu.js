// Menu do avatar no topo (padrão do LAEG-BIO): foto ou iniciais; ao tocar abre nome e e-mail,
// "Meu perfil", "Sobre o sistema" e "Sair". Substitui o botão "Sair" do topo.
// Nos dois lados: painel da Bea e páginas do cliente (montado por ui.js).
// A página Meu perfil avisa mudanças com o evento 'perfil-mudou' ({ nome, foto_url }).
import { sair } from './auth.js';
import { abrirSobre } from './sobre.js';
import { modoInstalacao, instalarAgora } from './instalar.js';

function el(tag, classe, ...filhos) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  no.append(...filhos.filter((f) => f != null));
  return no;
}

/** "Beatriz Souza" → "BS"; sem nome, a primeira letra do e-mail. */
export function iniciais(nome, email) {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length) return (partes[0][0] + (partes.length > 1 ? partes.at(-1)[0] : '')).toUpperCase();
  return (email ?? '?')[0].toUpperCase();
}

/** Círculo com a foto, ou com as iniciais se não houver foto (ou se ela não carregar). */
export function desenharAvatar(alvo, { nome, email, foto_url: foto }) {
  alvo.replaceChildren();
  alvo.classList.toggle('com-foto', Boolean(foto));
  if (foto) {
    const img = el('img');
    img.src = foto;
    img.alt = '';
    img.addEventListener('error', () => desenharAvatar(alvo, { nome, email, foto_url: null }), { once: true });
    alvo.append(img);
  } else {
    alvo.append(iniciais(nome, email));
  }
}

/**
 * @param {{ nome?: string, email: string, foto_url?: string }} perfil
 * @param {{ linkPerfil: string }} opcoes
 */
export function montarMenuPerfil(perfil, { linkPerfil }) {
  const topo = document.querySelector('.topo');
  if (!topo || topo.querySelector('.perfil-menu')) return;
  let atual = { ...perfil };

  const avatarBotao = el('span', 'avatar');
  const botao = el('button', 'perfil-botao', avatarBotao);
  botao.type = 'button';
  botao.setAttribute('aria-haspopup', 'menu');
  botao.setAttribute('aria-expanded', 'false');

  const avatarGrande = el('span', 'avatar avatar-grande');
  const nome = el('strong', 'perfil-nome');
  const email = el('span', 'perfil-email');
  const cabecalho = el('div', 'perfil-cabecalho', avatarGrande, el('div', 'perfil-quem', nome, email));

  const meuPerfil = el('a', 'perfil-item', 'Meu perfil');
  meuPerfil.href = linkPerfil;
  meuPerfil.setAttribute('role', 'menuitem');
  const sobre = el('button', 'perfil-item', 'Sobre o sistema');
  // Só aparece quando dá para instalar neste navegador (e ainda não está instalado).
  const instalar = el('button', 'perfil-item', 'Instalar o sistema');
  instalar.hidden = !modoInstalacao();
  const botaoSair = el('button', 'perfil-item perfil-sair', 'Sair');
  for (const b of [sobre, instalar, botaoSair]) {
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
  }

  // Aparência: claro, escuro ou do aparelho (tema.js guarda a escolha neste aparelho).
  const opcoesAparencia = [['claro', 'Claro'], ['escuro', 'Escuro'], ['aparelho', 'Do aparelho']].map(([valor, texto]) => {
    const b = el('button', 'perfil-aparencia-opcao', texto);
    b.type = 'button';
    b.dataset.valor = valor;
    b.setAttribute('role', 'menuitemradio');
    return b;
  });
  const marcarAparencia = () => {
    const atual = window.beaTema?.escolha() ?? 'aparelho';
    opcoesAparencia.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.valor === atual)));
  };
  opcoesAparencia.forEach((b) => b.addEventListener('click', () => {
    window.beaTema?.definir(b.dataset.valor);
    marcarAparencia();
  }));
  const aparencia = el('div', 'perfil-aparencia',
    el('span', 'perfil-aparencia-titulo', 'Aparência'),
    el('div', 'perfil-aparencia-opcoes', ...opcoesAparencia));
  aparencia.setAttribute('role', 'group');
  aparencia.setAttribute('aria-label', 'Aparência');
  marcarAparencia();

  const menu = el('div', 'perfil-lista', cabecalho, meuPerfil, aparencia, sobre, instalar, botaoSair);
  menu.setAttribute('role', 'menu');
  menu.id = 'perfil-lista';
  menu.hidden = true;
  botao.setAttribute('aria-controls', menu.id);

  function desenhar() {
    desenharAvatar(avatarBotao, atual);
    desenharAvatar(avatarGrande, atual);
    // Sem nome: convite para preencher, levando ao Meu perfil (onde se troca o nome).
    if (atual.nome?.trim()) {
      nome.textContent = atual.nome.trim();
    } else {
      const adicionar = el('a', 'perfil-adicionar-nome', 'Adicionar seu nome');
      adicionar.href = linkPerfil;
      adicionar.setAttribute('role', 'menuitem');
      nome.replaceChildren(adicionar);
    }
    email.textContent = atual.email;
    botao.setAttribute('aria-label', `Perfil de ${atual.nome?.trim() || atual.email}`);
  }

  const itens = () => [...menu.querySelectorAll('[role=menuitem]:not([hidden]), [role=menuitemradio]')];
  function abrir() {
    marcarAparencia(); // pode ter mudado em outra aba ou pelo aparelho
    menu.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    itens()[0].focus();
  }
  function fechar(voltarFoco = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    if (voltarFoco) botao.focus();
  }

  botao.addEventListener('click', () => (menu.hidden ? abrir() : fechar()));
  sobre.addEventListener('click', () => {
    fechar();
    abrirSobre();
  });
  instalar.addEventListener('click', () => {
    fechar();
    instalarAgora();
  });
  window.addEventListener('instalacao-mudou', (e) => { instalar.hidden = !e.detail.pode; });
  botaoSair.addEventListener('click', sair);
  document.addEventListener('click', (e) => {
    if (!caixa.contains(e.target)) fechar();
  });
  menu.addEventListener('keydown', (e) => {
    const lista = itens();
    const i = lista.indexOf(document.activeElement);
    if (e.key === 'Escape') fechar(true);
    else if (e.key === 'ArrowDown') lista[(i + 1) % lista.length].focus();
    else if (e.key === 'ArrowUp') lista[(i - 1 + lista.length) % lista.length].focus();
    else return;
    e.preventDefault();
  });
  window.addEventListener('perfil-mudou', (e) => {
    atual = { ...atual, ...e.detail };
    desenhar();
  });

  const caixa = el('div', 'perfil-menu', botao, menu);
  desenhar();
  // O "Sair" solto no topo dá lugar ao menu (o Sair agora fica dentro dele).
  const antigo = topo.querySelector('#sair');
  if (antigo) antigo.replaceWith(caixa);
  else topo.append(caixa);
}
