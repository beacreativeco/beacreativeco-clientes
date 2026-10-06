// Janela "Sobre o sistema" (rodapé do painel da Bea e da página do cliente), no
// mesmo padrão do sistema do LAEG-BIO. Versão e "O que há de novo" vêm do
// /CHANGELOG.md: a primeira entrada é a versão atual.

// Quem responde pelo sistema hoje. Quando a manutenção passar para outra
// pessoa, troque só este objeto (o e-mail vira link mailto: na janela).
export const MANUTENCAO = {
  nome: 'Victor Carvalho',
  email: 'victordevv.ui@gmail.com',
};

// Crédito de quem desenvolveu o sistema. Não muda quando a manutenção troca
// de mãos (aparece também no rodapé da tela de entrada, em /index.html).
export const DESENVOLVIMENTO = {
  nome: 'Victor Carvalho',
  portfolio: 'https://victorc-ai.github.io/vict-or/',
};

function el(tag, classe, ...filhos) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) n.append(f);
  return n;
}

/**
 * Lê o formato do CHANGELOG.md: "## [X.Y.Z] — dd/mm/aaaa", seções "### ..." e itens "- ...".
 * @returns {{ versao: string, data: string, secoes: { titulo: string, itens: string[] }[] }[]}
 */
export function lerChangelog(texto) {
  const versoes = [];
  for (const linha of texto.split(/\r?\n/)) {
    const entrada = linha.match(/^## \[(\d+\.\d+\.\d+)\]\s*[—-]\s*(.+?)\s*$/);
    if (entrada) {
      versoes.push({ versao: entrada[1], data: entrada[2], secoes: [] });
      continue;
    }
    const atual = versoes.at(-1);
    if (!atual) continue; // apresentação do arquivo, antes da primeira versão
    const secao = linha.match(/^### (.+?)\s*$/);
    if (secao) atual.secoes.push({ titulo: secao[1], itens: [] });
    else if (/^- /.test(linha) && atual.secoes.length) atual.secoes.at(-1).itens.push(linha.slice(2).trim());
  }
  return versoes;
}

let versoes;
const carregarVersoes = async () => {
  if (versoes) return versoes;
  const resp = await fetch('/CHANGELOG.md', { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`CHANGELOG.md: ${resp.status}`);
  versoes = lerChangelog(await resp.text());
  return versoes;
};

let janela;
function montarJanela() {
  const logo = el('img', 'sobre-logo');
  logo.src = '/assets/img/logo-beacreative.svg';
  logo.alt = 'BeaCreative';
  logo.width = 883;
  logo.height = 153;
  const titulo = el('h2', null, logo, el('span', null, 'Aprovação'));
  titulo.id = 'sobre-titulo';
  const versao = el('p', 'sobre-versao', 'Versão …');

  const novidades = el('section', 'sobre-novidades');
  novidades.id = 'sobre-novidades';
  novidades.setAttribute('aria-label', 'O que há de novo');
  novidades.hidden = true;
  const botaoNovidades = el('button', 'sobre-novidades-botao', 'O que há de novo');
  botaoNovidades.type = 'button';
  botaoNovidades.setAttribute('aria-expanded', 'false');
  botaoNovidades.setAttribute('aria-controls', novidades.id);
  botaoNovidades.addEventListener('click', () => {
    novidades.hidden = !novidades.hidden;
    botaoNovidades.setAttribute('aria-expanded', String(!novidades.hidden));
  });

  const monograma = el('img', 'sobre-monograma');
  monograma.src = '/assets/img/monograma.png';
  monograma.alt = '';
  monograma.width = 205;
  monograma.height = 256;

  const logoDev = el('img', 'sobre-dev-logo');
  logoDev.src = '/assets/img/vict-or-completo.svg';
  logoDev.alt = '';
  logoDev.width = 56;
  logoDev.height = 68;
  const portfolio = el('a', null, 'Ver portfólio', el('span', 'so-leitor', ' (abre em nova aba)'));
  portfolio.href = DESENVOLVIMENTO.portfolio;
  portfolio.target = '_blank';
  portfolio.rel = 'noopener';
  const email = el('a', null, MANUTENCAO.email);
  email.href = `mailto:${MANUTENCAO.email}`;

  const fechar = el('button', 'botao-secundario sobre-fechar', 'Fechar');
  fechar.type = 'button';

  janela = el('dialog', 'sobre',
    el('div', 'sobre-marca', monograma, el('div', null, titulo, versao, botaoNovidades)),
    novidades,
    el('p', 'sobre-descricao', 'Sistema de aprovação de conteúdo da BeaCreative.'),
    el('dl', 'sobre-lista',
      el('div', 'sobre-bloco',
        el('dt', null, 'Desenvolvido por'),
        el('dd', 'sobre-dev', logoDev, el('span', null, el('strong', null, DESENVOLVIMENTO.nome), portfolio))),
      el('div', 'sobre-bloco',
        el('dt', null, 'Responsável pela manutenção'),
        el('dd', null, el('strong', null, MANUTENCAO.nome), email))),
    fechar);
  janela.setAttribute('aria-labelledby', titulo.id);
  fechar.addEventListener('click', () => janela.close());
  // Toque fora da janela (no fundo escurecido) fecha.
  janela.addEventListener('click', (e) => { if (e.target === janela) janela.close(); });
  janela.addEventListener('close', () => {
    novidades.hidden = true;
    botaoNovidades.setAttribute('aria-expanded', 'false');
  });
  document.body.append(janela);

  carregarVersoes().then((lista) => {
    versao.textContent = `Versão ${lista[0]?.versao ?? '—'}`;
    novidades.replaceChildren(...lista.map((v) => el('div', 'sobre-versao-item',
      el('h3', null, `Versão ${v.versao} · ${v.data}`),
      v.secoes.map((s) => [el('h4', null, s.titulo), el('ul', null, s.itens.map((i) => el('li', null, i)))]))));
  }).catch((err) => {
    console.error(err);
    versao.textContent = 'Versão indisponível agora';
    botaoNovidades.hidden = true;
  });
}

export function abrirSobre() {
  if (!janela) montarJanela();
  janela.showModal();
}

/** Rodapé discreto com o link "Sobre o sistema" no fim da página. */
export function ligarRodapeSobre(alvo = document.getElementById('app') ?? document.body) {
  if (document.querySelector('.rodape-sistema')) return;
  const botao = el('button', 'rodape-sobre', 'Sobre o sistema');
  botao.type = 'button';
  botao.addEventListener('click', abrirSobre);
  alvo.append(el('footer', 'rodape-sistema', botao));
}
