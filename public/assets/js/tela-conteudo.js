// Tela do conteúdo com a conversa dentro (página do cliente e editor da Bea). É a mesma
// conversa da aba Mensagens, só a parte sobre este conteúdo (criarConversa com conteudoId).
//   Computador: prévia à esquerda e conversa à direita, na altura da tela (na Bea, na aba
//   "Conversa"; a aba "Editar" continua sendo o editor de arquivos e legenda).
//   Celular: abas no topo. Na "Conversa", a tela é toda dela (acompanha o teclado), com a
//   miniatura do conteúdo fixa em cima; tocar nela abre a prévia ampliada por cima, e
//   fechar volta para a conversa no mesmo ponto.
// O HTML da página traz as partes (.tc-abas, .tc-parte-previa, .tc-parte-conversa e, na
// Bea, .tc-parte-editar); este módulo liga tudo e cuida do número de não lidas na aba.
import { supabase } from './supabase.js';
import { criarConversa, acompanharTeclado } from './conversa.js';
import { expirou } from './conteudos.js';

const COMPUTADOR = window.matchMedia('(min-width: 900px)');

function el(tag, classe, ...filhos) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f);
  return n;
}

function icone(caminho) {
  const s = el('span', 'tc-icone');
  s.setAttribute('aria-hidden', 'true');
  // Desenhos fixos deste arquivo (nunca dado de usuário).
  s.innerHTML = `<svg viewBox="0 0 24 24">${caminho}</svg>`;
  return s;
}
const ICONE_AMPLIAR = '<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/>';
const ICONE_VOLTAR = '<path d="m14.5 6-6 6 6 6"/>';
const ICONE_VIDEO = '<path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/>';

/**
 * @param {{
 *   pagina: HTMLElement,                 // <main class="tela-conteudo" data-aba="…">
 *   abaInicial: 'previa' | 'editar',     // a aba que não é a conversa
 *   divididaNoComputador: boolean,       // cliente: prévia + conversa sempre lado a lado
 *   voltar: string,                      // seta do celular, na conversa em tela cheia
 *   conversa: object,                    // opções de criarConversa (clienteId, conteudoId, eu…)
 *   aoChegar?: (m: object) => void,      // mensagem nova da outra pessoa
 * }} opcoes
 */
export function montarTelaDoConteudo({ pagina, abaInicial, divididaNoComputador, voltar, conversa: opcoesConversa, aoChegar }) {
  const parteConversa = pagina.querySelector('.tc-parte-conversa');
  const partePrevia = pagina.querySelector('.tc-parte-previa');
  const abas = [...pagina.querySelectorAll('.tc-aba')];
  const contador = pagina.querySelector('.tc-aba[data-aba="conversa"] .nao-lidas');
  const conteudoId = opcoesConversa.conteudoId;

  // Seta de voltar (só aparece na conversa em tela cheia do celular).
  const seta = pagina.querySelector('.tc-voltar');
  seta.href = voltar;
  seta.replaceChildren(icone(ICONE_VOLTAR));

  // ------------------------------------------------------------ miniatura fixa (celular)

  const mini = el('button', 'tc-mini');
  mini.type = 'button';
  mini.setAttribute('aria-label', 'Ver a prévia do conteúdo');
  parteConversa.prepend(mini);

  /** @param {{ titulo: string, situacao?: {texto: string, classe: string}, midias: object[] }} info */
  function atualizarMini({ titulo, situacao, midias }) {
    const primeira = midias?.[0];
    const quadro = el('span', 'tc-mini-quadro');
    if (primeira && !expirou(primeira.expira_em)) {
      if (primeira.tipo === 'imagem') {
        const img = el('img');
        img.src = primeira.arquivo_url;
        img.alt = '';
        img.addEventListener('error', () => img.replaceWith('✦'), { once: true });
        quadro.append(img);
      } else {
        // Vídeo: o primeiro quadro, sem som e sem tocar (só os metadados e um pedacinho).
        const v = el('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'metadata';
        v.src = `${primeira.arquivo_url}#t=0.1`;
        v.addEventListener('error', () => v.replaceWith(icone(ICONE_VIDEO)), { once: true });
        quadro.append(v, el('span', 'tc-mini-play', icone(ICONE_VIDEO)));
      }
    } else {
      quadro.append('✦');
    }
    mini.replaceChildren(
      quadro,
      el('span', 'tc-mini-info',
        el('span', 'tc-mini-titulo', titulo),
        situacao ? el('span', `situacao ${situacao.classe}`, situacao.texto) : null),
      el('span', 'tc-mini-ver', icone(ICONE_AMPLIAR), el('span', null, 'Ver prévia')));
  }

  // ------------------------------------------------------------ prévia ampliada (celular)

  const fecharPrevia = el('button', 'tc-fechar-previa', '×');
  fecharPrevia.type = 'button';
  fecharPrevia.setAttribute('aria-label', 'Fechar a prévia');
  partePrevia.prepend(fecharPrevia);

  const videosDaPrevia = () => partePrevia.querySelectorAll('.previa-tela video');
  const pausarPrevia = () => videosDaPrevia().forEach((v) => v.pause());

  let ampliada = false;
  function abrirPrevia() {
    if (ampliada) return;
    ampliada = true;
    document.body.classList.add('tc-vendo-previa');
    partePrevia.setAttribute('role', 'dialog');
    partePrevia.setAttribute('aria-modal', 'true');
    partePrevia.setAttribute('aria-label', 'Prévia do conteúdo');
    // Direto na prévia (título e prazo ficam logo acima, rolando).
    const previa = partePrevia.querySelector('.previa');
    partePrevia.scrollTop = previa ? Math.max(0, previa.offsetTop - 60) : 0;
    // O botão "voltar" do celular fecha a prévia, não sai da página.
    history.pushState({ tcPrevia: true }, '');
    fecharPrevia.focus({ preventScroll: true });
    // Vídeo tocando, como no app (o toque na miniatura libera o som).
    const video = videosDaPrevia()[0];
    video?.play().catch(() => {});
  }
  function fecharAmpliada() {
    if (!ampliada) return;
    ampliada = false;
    document.body.classList.remove('tc-vendo-previa');
    partePrevia.removeAttribute('role');
    partePrevia.removeAttribute('aria-modal');
    partePrevia.removeAttribute('aria-label');
    pausarPrevia();
    mini.focus({ preventScroll: true });
  }
  mini.addEventListener('click', abrirPrevia);
  fecharPrevia.addEventListener('click', () => history.back());
  window.addEventListener('popstate', fecharAmpliada);
  partePrevia.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ampliada) history.back();
  });

  // ------------------------------------------------------------ abas

  const naConversa = () => pagina.dataset.aba === 'conversa';
  // A conversa está à vista? Só aí as mensagens contam como lidas.
  const conversaAVista = () => naConversa() || (divididaNoComputador && COMPUTADOR.matches);

  function mostrarAba(aba) {
    if (aba !== 'conversa') aba = abaInicial;
    const mudou = pagina.dataset.aba !== aba;
    pagina.dataset.aba = aba;
    for (const b of abas) {
      const ativa = b.dataset.aba === aba;
      b.setAttribute('aria-selected', String(ativa));
      b.tabIndex = ativa ? 0 : -1;
    }
    document.body.classList.toggle('tc-na-conversa', aba === 'conversa');
    // Recarregar a página volta na mesma aba (e o link pode abrir direto na conversa).
    const url = new URL(location.href);
    if (aba === 'conversa') url.searchParams.set('aba', 'conversa');
    else url.searchParams.delete('aba');
    url.hash = '';
    history.replaceState(history.state, '', url);
    if (!mudou) return;
    if (aba === 'conversa') {
      // Celular: a prévia fica escondida; vídeo tocando atrás da conversa, não.
      if (!COMPUTADOR.matches) pausarPrevia();
      conversa.marcarLida();
      ajustarAltura();
    } else {
      window.scrollTo({ top: 0 });
    }
  }

  abas.forEach((b, i) => {
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => mostrarAba(b.dataset.aba));
    // Setas trocam de aba, como nas abas do sistema operacional.
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const outra = abas[(i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
      outra.focus();
      mostrarAba(outra.dataset.aba);
    });
  });

  // ------------------------------------------------------------ altura (computador)

  // A conversa vai do ponto em que começa até o pé da tela, com a caixa de escrever
  // sempre à vista. Quanto há em cima (trilha, abas) muda com a página: medido aqui.
  // offsetTop (e não getBoundingClientRect): não conta o deslizar da entrada da página.
  const grade = pagina.querySelector('.tc-grade');
  function ajustarAltura() {
    let topo = 0;
    for (let e = grade; e; e = e.offsetParent) topo += e.offsetTop;
    if (topo) pagina.style.setProperty('--tc-acima', `${topo}px`);
  }
  window.addEventListener('resize', ajustarAltura);
  // A página aparecendo (estava escondida enquanto carregava) e a trilha ou as abas mudando.
  new ResizeObserver(ajustarAltura).observe(pagina);
  COMPUTADOR.addEventListener('change', () => {
    ajustarAltura();
    if (conversaAVista()) conversa.marcarLida();
  });

  // ------------------------------------------------------------ conversa

  const conversa = criarConversa(parteConversa.querySelector('.tc-conversa-corpo'), {
    ...opcoesConversa,
    tela: true,
    visivel: conversaAVista,
    aoChegar: (m) => {
      contarNaoLidas();
      aoChegar?.(m);
    },
  });

  // Número de mensagens novas da outra pessoa sobre este conteúdo, na aba "Conversa".
  async function contarNaoLidas() {
    if (!contador) return;
    const { data, error } = await supabase.rpc('conversas_nao_lidas');
    if (error) return console.error(error);
    const n = data.find((c) => c.conteudo_id === conteudoId)?.quantidade ?? 0;
    contador.textContent = n > 99 ? '99+' : String(n);
    contador.hidden = n === 0;
    contador.setAttribute('aria-label', `${n} não ${n === 1 ? 'lida' : 'lidas'}`);
  }
  window.addEventListener('conversa-lida', () => contarNaoLidas());

  acompanharTeclado();
  const inicial = new URLSearchParams(location.search).get('aba') === 'conversa' || location.hash === '#conversa'
    ? 'conversa' : abaInicial;
  pagina.dataset.aba = '';
  mostrarAba(inicial);

  return {
    conversa,
    atualizarMini,
    mostrarAba,
    async carregar() {
      await conversa.carregar();
      await contarNaoLidas();
      ajustarAltura();
    },
    /** "Pedir ajuste": abre a conversa com o pedido pronto para escrever ou gravar. */
    async pedirAjuste() {
      if (ampliada) history.back();
      mostrarAba('conversa');
      await conversa.pedirAjuste(conteudoId);
    },
    /** Depois que a página aparece (antes disso a trilha ainda não tem altura). */
    ajustarAltura,
  };
}
