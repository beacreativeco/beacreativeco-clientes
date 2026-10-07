// Menu do avatar no topo (padrão do LAEG-BIO): foto ou iniciais; ao tocar abre nome e e-mail,
// "Meu perfil", "Sobre o sistema" e "Sair". Substitui o botão "Sair" do topo.
// Painel da Bea agora; o cliente ganha o mesmo menu no item 5d.
// A página Meu perfil avisa mudanças com o evento 'perfil-mudou' ({ nome, foto_url }).
import { sair } from './auth.js';
import { abrirSobre } from './sobre.js';

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
  const botaoSair = el('button', 'perfil-item perfil-sair', 'Sair');
  for (const b of [sobre, botaoSair]) {
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
  }

  const menu = el('div', 'perfil-lista', cabecalho, meuPerfil, sobre, botaoSair);
  menu.setAttribute('role', 'menu');
  menu.id = 'perfil-lista';
  menu.hidden = true;
  botao.setAttribute('aria-controls', menu.id);

  function desenhar() {
    desenharAvatar(avatarBotao, atual);
    desenharAvatar(avatarGrande, atual);
    nome.textContent = atual.nome?.trim() || 'Sem nome';
    email.textContent = atual.email;
    botao.setAttribute('aria-label', `Perfil de ${atual.nome?.trim() || atual.email}`);
  }

  const itens = () => [...menu.querySelectorAll('[role=menuitem]')];
  function abrir() {
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
