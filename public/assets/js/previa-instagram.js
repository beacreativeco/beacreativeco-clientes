// Pré-visualização fiel ao Instagram (Reels, Story, post e carrossel), no estilo da
// "Prévia de mídia social" do CapCut. Ícones desenhados por nós (sem logo do Instagram).
//
// Medidas em "u": 1u = 1/390 da largura da tela (largura lógica de um iPhone), então tudo
// fica proporcional em qualquer tamanho. As faixas das guias estão em pixels de um vídeo
// 1080 × 1920, que é como a Bea monta o arquivo no CapCut ou no Canva.
import { expirou, avisarSeSumiu } from './conteudos.js';

const FAIXAS = {
  reels: [
    { nome: 'Nome e câmera', topo: 0, altura: 250 },
    { nome: 'Perfil, legenda e áudio', base: 0, altura: 420 },
    { nome: 'Botões', direita: 0, largura: 230, topo: 960, base: 420 },
  ],
  story: [
    { nome: 'Barras e perfil', topo: 0, altura: 250 },
    { nome: 'Resposta', base: 0, altura: 340 },
  ],
};

const SEGUNDOS_FOTO_STORY = 5;

const ICONES = {
  coracao: '<path d="M12 20.3s-7.4-4.5-9.1-9.1C1.7 7.9 3.8 4.6 7.2 4.6c2 0 3.5 1.1 4.8 2.9 1.3-1.8 2.8-2.9 4.8-2.9 3.4 0 5.5 3.3 4.3 6.6-1.7 4.6-9.1 9.1-9.1 9.1z"/>',
  balao: '<path d="M20.6 11.6a8.6 8.6 0 0 1-12.5 7.6l-4.6 1.3 1.4-4.4a8.6 8.6 0 1 1 15.7-4.5z"/>',
  aviao: '<path d="M21.4 3.2 2.9 10.3l7.3 3.2 3.2 7.3z"/><path d="m21.4 3.2-11.2 10.3"/>',
  salvar: '<path d="M6.2 3.6h11.6v16.8L12 15.3l-5.8 5.1z"/>',
  repostar: '<path d="m16.8 2.8 3 3-3 3"/><path d="M4.2 11.2V9.8a4 4 0 0 1 4-4h11.4"/><path d="m7.2 21.2-3-3 3-3"/><path d="M19.8 12.8v1.4a4 4 0 0 1-4 4H4.4"/>',
  mais: '<circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>',
  camera: '<path d="M3.2 8.6a2.4 2.4 0 0 1 2.4-2.4h2.1l1.6-2.2h5.4l1.6 2.2h2.1a2.4 2.4 0 0 1 2.4 2.4v9a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4z"/><circle cx="12" cy="13" r="3.6"/>',
  nota: '<path d="M9 17.5V5.2l10.5-2v12"/><circle cx="6.4" cy="17.6" r="2.6"/><circle cx="16.9" cy="15.3" r="2.6"/>',
  somLigado: '<path d="M4 9.4h3.4L12 5.6v12.8l-4.6-3.8H4z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6"/><path d="M17.9 6.6a7.6 7.6 0 0 1 0 10.8"/>',
  somDesligado: '<path d="M4 9.4h3.4L12 5.6v12.8l-4.6-3.8H4z"/><path d="m15.6 9.5 5 5"/><path d="m20.6 9.5-5 5"/>',
  fechar: '<path d="m5.5 5.5 13 13"/><path d="m18.5 5.5-13 13"/>',
  abrir: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  anterior: '<path d="m14.5 6-6 6 6 6"/>',
  proxima: '<path d="m9.5 6 6 6-6 6"/>',
};

// ---------------------------------------------------------------- ajudantes

function el(tag, classe, ...filhos) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f);
  return n;
}

function icone(nome, classe = '') {
  const span = el('span', `ig-icone ${classe}`.trim());
  span.setAttribute('aria-hidden', 'true');
  // Strings fixas deste arquivo (nunca dado de usuário).
  span.innerHTML = `<svg viewBox="0 0 24 24">${ICONES[nome]}</svg>`;
  return span;
}

function arroba(cliente) {
  if (cliente?.instagram) return cliente.instagram.replace(/^@/, '');
  return (cliente?.nome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9._]+/g, '').slice(0, 30) || 'cliente';
}

function avatar(cliente) {
  const a = el('span', 'ig-avatar');
  if (cliente?.foto_perfil) {
    const img = new Image();
    img.src = cliente.foto_perfil;
    img.alt = '';
    a.append(img);
  } else {
    a.textContent = (cliente?.nome || '?').trim().charAt(0).toUpperCase();
  }
  return a;
}

// #hashtags e @menções destacadas como no app, sem innerHTML.
function textoComTags(texto) {
  const frag = document.createDocumentFragment();
  let ultimo = 0;
  for (const m of texto.matchAll(/[#@][\p{L}\p{N}_.]+/gu)) {
    frag.append(texto.slice(ultimo, m.index), el('span', 'ig-tag', m[0]));
    ultimo = m.index + m[0].length;
  }
  frag.append(texto.slice(ultimo));
  return frag;
}

/**
 * Legenda como no app: cabe em `linhas` linhas terminando em "… mais"; clicar abre inteira.
 * Mede de verdade (busca binária no tamanho do texto), então respeita quebras de linha,
 * emojis e a largura real da tela.
 */
function criarLegenda(classe, { prefixo = null, linhas = 2, fechaAoTocar = false } = {}) {
  const p = el('p', classe);
  let texto = '';
  let aberta = false;

  function montar(n) {
    const corte = n < texto.length;
    p.replaceChildren(
      ...(prefixo ? [el('strong', null, prefixo), ' '] : []),
      textoComTags(corte ? texto.slice(0, n).trimEnd() : texto),
      ...(corte ? ['… ', el('span', 'ig-mais', 'mais')] : []));
  }

  function cortar() {
    p.hidden = !texto;
    p.classList.toggle('aberta', aberta);
    montar(texto.length);
    // Escondida (interface oculta) não tem medida: corta de novo quando reaparecer.
    if (aberta || !texto || !p.offsetParent) return;
    const limite = parseFloat(getComputedStyle(p).lineHeight) * linhas + 1;
    if (p.scrollHeight <= limite) return;
    let cabe = 0;
    let naoCabe = texto.length;
    while (naoCabe - cabe > 1) {
      const meio = Math.floor((cabe + naoCabe) / 2);
      montar(meio);
      if (p.scrollHeight <= limite) cabe = meio; else naoCabe = meio;
    }
    // Termina numa palavra inteira, a não ser que a última palavra seja enorme.
    const espaco = Math.max(texto.lastIndexOf(' ', cabe), texto.lastIndexOf('\n', cabe));
    montar(espaco > cabe - 20 && espaco > 0 ? espaco : cabe);
  }

  // Feed: abre no "mais" e fica aberta. Reels: tocar abre e tocar de novo fecha.
  p.addEventListener('click', () => {
    if (!aberta && !p.querySelector('.ig-mais')) return;
    if (aberta && !fechaAoTocar) return;
    aberta = !aberta;
    cortar();
  });

  return {
    elemento: p,
    definir(novo) {
      texto = novo;
      cortar();
    },
    recortar: cortar,
  };
}

function dataDoFeed(iso) {
  if (!iso) return 'Agora';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

// Arquivo que a exclusão automática já apagou: aviso no lugar, nunca imagem quebrada.
function expirado(drive) {
  const caixa = el('div', 'ig-expirado', el('p', null, 'Arquivo expirado'));
  if (drive) {
    const link = el('a', null, 'Veja no Drive');
    link.href = drive;
    link.target = '_blank';
    link.rel = 'noopener';
    caixa.append(link);
  } else {
    caixa.append(el('p', 'ig-expirado-dica', 'O original está no Drive.'));
  }
  return caixa;
}

function criarMidia(m, { video: opcoesVideo = {}, fundo = false, drive = '' } = {}) {
  if (expirou(m.expira_em)) return expirado(drive);
  if (m.tipo === 'video') {
    const v = el('video', 'ig-video');
    Object.assign(v, { src: m.arquivo_url, muted: true, playsInline: true, preload: 'auto', ...opcoesVideo });
    v.setAttribute('playsinline', '');
    avisarSeSumiu(v, m.arquivo_url, () => expirado(drive));
    return v;
  }
  const img = new Image();
  img.src = m.arquivo_url;
  img.alt = '';
  img.decoding = 'async';
  img.className = 'ig-imagem';
  if (!fundo) {
    avisarSeSumiu(img, m.arquivo_url, () => expirado(drive));
    return img;
  }
  // Story com foto fora de 9:16: o app preenche o fundo com a própria foto desfocada.
  const fundoImg = img.cloneNode();
  fundoImg.className = 'ig-imagem-fundo';
  const caixa = el('div', 'ig-imagem-com-fundo', fundoImg, img);
  img.addEventListener('error', () => {
    fetch(m.arquivo_url, { method: 'HEAD', cache: 'no-store' })
      .then((r) => { if (r.status === 404) caixa.replaceWith(expirado(drive)); }).catch(() => {});
  }, { once: true });
  return caixa;
}

function vazio(texto) {
  return el('div', 'ig-vazio', texto);
}

function guias(formato) {
  const camada = el('div', 'ig-guias');
  for (const f of FAIXAS[formato] ?? []) {
    const faixa = el('div', 'ig-faixa', el('span', 'ig-faixa-nome',
      `${f.nome} · ${f.largura ? `${f.largura} px` : `${f.altura} px`}`));
    const pct = (px, total) => `${(px / total) * 100}%`;
    if (f.topo != null) faixa.style.top = pct(f.topo, 1920);
    if (f.base != null) faixa.style.bottom = pct(f.base, 1920);
    if (f.altura != null) faixa.style.height = pct(f.altura, 1920);
    if (f.direita != null) {
      faixa.style.right = pct(f.direita, 1080);
      faixa.style.width = pct(f.largura, 1080);
      faixa.classList.add('ig-faixa-lateral');
    } else {
      faixa.style.left = '0';
      faixa.style.right = '0';
    }
    camada.append(faixa);
  }
  return camada;
}

// ---------------------------------------------------------------- Reels

function montarReels(estado, tela) {
  const m = estado.midias.find((x) => x.tipo === 'video');
  const raiz = el('div', 'ig-reels');
  const palco = el('div', 'ig-palco');
  let video = null;

  if (m) {
    video = criarMidia(m, { video: { loop: true, autoplay: true }, drive: estado.drive });
    palco.append(video);
  } else {
    palco.append(vazio(estado.midias.length ? 'Reels precisa de vídeo.' : 'Adicione o vídeo para ver a prévia.'));
  }

  const flash = el('div', 'ig-som-flash');
  const progresso = el('div', 'ig-progresso', el('span', 'ig-progresso-feito'));
  const legenda = criarLegenda('ig-reels-legenda', { fechaAoTocar: true });

  const ui = el('div', 'ig-ui',
    el('div', 'ig-sombra-topo'),
    el('div', 'ig-sombra-base'),
    el('div', 'ig-reels-topo',
      el('span', 'ig-reels-titulo', 'Reels', icone('abrir', 'ig-icone-pequeno')),
      icone('camera')),
    el('div', 'ig-reels-trilho',
      el('span', 'ig-acao', icone('coracao'), el('small', null, '2.481')),
      el('span', 'ig-acao', icone('balao'), el('small', null, '96')),
      el('span', 'ig-acao', icone('repostar'), el('small', null, '37')),
      el('span', 'ig-acao', icone('aviao'), el('small', null, '152')),
      el('span', 'ig-acao', icone('mais')),
      el('span', 'ig-reels-capa-audio', avatar(estado.cliente))),
    el('div', 'ig-reels-info',
      el('div', 'ig-perfil', avatar(estado.cliente), el('strong', null, arroba(estado.cliente)),
        el('span', 'ig-seguir', 'Seguir')),
      legenda.elemento,
      el('div', 'ig-audio', icone('nota', 'ig-icone-pequeno'),
        el('span', null, `${arroba(estado.cliente)} · Áudio original`))),
    progresso);

  raiz.append(palco, ui, flash, guias('reels'));
  tela.append(raiz);


  if (video) {
    // Toque no vídeo liga/desliga o som, com o ícone piscando no meio (como no app).
    palco.addEventListener('click', () => {
      video.muted = !video.muted;
      flash.replaceChildren(icone(video.muted ? 'somDesligado' : 'somLigado'));
      flash.classList.remove('visivel');
      void flash.offsetWidth;
      flash.classList.add('visivel');
    });
    const feito = progresso.firstChild;
    video.addEventListener('timeupdate', () => {
      if (video.duration) feito.style.width = `${(video.currentTime / video.duration) * 100}%`;
    });
    progresso.addEventListener('click', (e) => {
      const r = progresso.getBoundingClientRect();
      if (video.duration) video.currentTime = ((e.clientX - r.left) / r.width) * video.duration;
    });
  }

  return {
    atualizarTexto() { legenda.definir(estado.legenda.trim()); },
    recortar: () => legenda.recortar(),
    parar() { video?.pause(); },
  };
}

// ---------------------------------------------------------------- Story

function montarStory(estado, tela) {
  const itens = estado.midias;
  const raiz = el('div', 'ig-story');
  const palco = el('div', 'ig-palco');
  const barras = el('div', 'ig-story-barras',
    (itens.length ? itens : [null]).map(() => el('span', 'ig-barra', el('span', 'ig-barra-feita'))));
  const botaoSom = el('button', 'ig-botao-som', icone('somDesligado'));
  botaoSom.type = 'button';
  botaoSom.setAttribute('aria-label', 'Ligar o som');

  const ui = el('div', 'ig-ui',
    el('div', 'ig-sombra-topo'),
    barras,
    el('div', 'ig-story-topo',
      avatar(estado.cliente),
      el('strong', null, arroba(estado.cliente)),
      el('span', 'ig-tempo', '2 h'),
      el('span', 'ig-espaco'),
      botaoSom,
      icone('mais'),
      icone('fechar')),
    el('div', 'ig-story-base',
      el('span', 'ig-responder', 'Enviar mensagem'),
      icone('coracao'),
      icone('aviao')));

  raiz.append(palco, ui, guias('story'));
  tela.append(raiz);

  if (!itens.length) {
    palco.append(vazio('Adicione imagens ou vídeos para ver a prévia.'));
    botaoSom.hidden = true;
    return { atualizarTexto() {}, recortar() {}, parar() {} };
  }

  let atual = 0;
  let inicio = 0;        // performance.now() do começo do item, descontadas as pausas
  let pausadoEm = null;
  let somLigado = false;
  let quadro = 0;
  let video = null;
  const feitas = [...barras.querySelectorAll('.ig-barra-feita')];

  function mostrar(i) {
    atual = (i + itens.length) % itens.length;
    const m = itens[atual];
    feitas.forEach((f, n) => { f.style.width = n < atual ? '100%' : '0%'; });
    video?.pause();
    const midia = criarMidia(m, { fundo: true, video: { autoplay: true, muted: !somLigado }, drive: estado.drive });
    video = m.tipo === 'video' ? midia : null;
    botaoSom.hidden = !video;
    video?.addEventListener('ended', () => mostrar(atual + 1));
    palco.replaceChildren(midia);
    inicio = performance.now();
    if (pausadoEm != null) pausadoEm = inicio;
  }

  function animar(agora) {
    const barra = feitas[atual];
    if (video) {
      if (video.duration) barra.style.width = `${(video.currentTime / video.duration) * 100}%`;
    } else if (pausadoEm == null) {
      const fracao = (agora - inicio) / (SEGUNDOS_FOTO_STORY * 1000);
      barra.style.width = `${Math.min(fracao, 1) * 100}%`;
      if (fracao >= 1) mostrar(atual + 1);
    }
    quadro = requestAnimationFrame(animar);
  }

  // Toque rápido: esquerda volta, direita avança. Segurar pausa (como no app).
  let tocouEm = 0;
  palco.addEventListener('pointerdown', () => {
    tocouEm = performance.now();
    pausadoEm = tocouEm;
    video?.pause();
  });
  const soltar = (e) => {
    if (pausadoEm == null) return;
    inicio += performance.now() - pausadoEm;
    pausadoEm = null;
    if (e.type === 'pointerup' && performance.now() - tocouEm < 250) {
      const r = palco.getBoundingClientRect();
      mostrar(e.clientX - r.left < r.width / 3 ? atual - 1 : atual + 1);
    } else {
      video?.play().catch(() => {});
    }
  };
  palco.addEventListener('pointerup', soltar);
  palco.addEventListener('pointerleave', soltar);

  botaoSom.addEventListener('click', () => {
    somLigado = !somLigado;
    if (video) video.muted = !somLigado;
    botaoSom.replaceChildren(icone(somLigado ? 'somLigado' : 'somDesligado'));
    botaoSom.setAttribute('aria-label', somLigado ? 'Desligar o som' : 'Ligar o som');
  });

  // Aba escondida: pausa, senão a foto pularia para a próxima ao voltar.
  let escondidaEm = null;
  const aoMudarVisibilidade = () => {
    if (document.hidden) {
      escondidaEm = performance.now();
    } else if (escondidaEm != null) {
      inicio += performance.now() - escondidaEm;
      escondidaEm = null;
    }
  };
  document.addEventListener('visibilitychange', aoMudarVisibilidade);

  mostrar(0);
  quadro = requestAnimationFrame(animar);

  return {
    atualizarTexto() {},
    recortar() {},
    parar() {
      cancelAnimationFrame(quadro);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      video?.pause();
    },
  };
}

// ---------------------------------------------------------------- Feed (post e carrossel)

function montarFeed(estado, tela) {
  const itens = estado.midias;
  const nome = arroba(estado.cliente);
  const trilho = el('div', 'ig-post-trilho');
  const contador = el('span', 'ig-post-contador');
  const pontos = el('div', 'ig-pontos');
  const videos = [];

  if (!itens.length) {
    trilho.append(el('div', 'ig-post-item', vazio('Adicione as imagens para ver a prévia.')));
  }
  for (const m of itens) {
    const item = el('div', 'ig-post-item', criarMidia(m, { video: { loop: true, autoplay: true }, drive: estado.drive }));
    if (m.tipo === 'video') {
      const v = item.firstChild;
      videos.push(v);
      const som = el('button', 'ig-botao-som ig-botao-som-feed', icone('somDesligado'));
      som.type = 'button';
      som.setAttribute('aria-label', 'Ligar o som');
      som.addEventListener('click', () => {
        v.muted = !v.muted;
        som.replaceChildren(icone(v.muted ? 'somDesligado' : 'somLigado'));
      });
      item.append(som);
    }
    trilho.append(item);
  }

  // Navegação do carrossel: deslizar com encaixe (CSS), setinhas no computador e teclado.
  const seta = (nome, rotulo) => {
    const b = el('button', `ig-seta ig-seta-${nome}`, icone(nome));
    b.type = 'button';
    b.setAttribute('aria-label', rotulo);
    return b;
  };
  const setaAnterior = seta('anterior', 'Imagem anterior');
  const setaProxima = seta('proxima', 'Próxima imagem');
  const midia = el('div', 'ig-post-midia', trilho, contador, setaAnterior, setaProxima);
  const atual = () => (trilho.clientWidth ? Math.round(trilho.scrollLeft / trilho.clientWidth) : 0);
  let marcar = () => {};
  // Marca o destino na hora (não espera a animação): se a ordem mudar no meio, a posição vale.
  const irPara = (i, suave = true) => {
    const alvo = Math.max(0, Math.min(itens.length - 1, i));
    marcar(alvo);
    trilho.scrollTo({ left: alvo * trilho.clientWidth, behavior: suave ? 'smooth' : 'instant' });
  };

  if (itens.length > 1) {
    itens.forEach(() => pontos.append(el('span', 'ig-ponto')));
    marcar = (i = atual()) => {
      estado.posicaoCarrossel = i;
      contador.textContent = `${i + 1}/${itens.length}`;
      [...pontos.children].forEach((p, n) => p.classList.toggle('ativo', n === i));
      setaAnterior.hidden = i === 0;
      setaProxima.hidden = i === itens.length - 1;
    };
    // Deslizar com o dedo: o encaixe decide a imagem, marcada quando a rolagem termina.
    trilho.addEventListener('scrollend', () => marcar());
    trilho.addEventListener('scroll', () => { if (!('onscrollend' in trilho)) marcar(); }, { passive: true });
    // Depois do clique o foco vai para as imagens: a seta some na ponta e o teclado continua.
    setaAnterior.addEventListener('click', () => { irPara(atual() - 1); trilho.focus({ preventScroll: true }); });
    setaProxima.addEventListener('click', () => { irPara(atual() + 1); trilho.focus({ preventScroll: true }); });
    // Teclado só com a prévia em foco: na legenda, as setas continuam movendo o cursor.
    trilho.tabIndex = 0;
    trilho.setAttribute('aria-label', `Carrossel com ${itens.length} itens. Use as setas para navegar.`);
    midia.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      irPara(atual() + (e.key === 'ArrowRight' ? 1 : -1));
    });
  } else {
    contador.hidden = true;
    setaAnterior.hidden = true;
    setaProxima.hidden = true;
  }

  const legenda = criarLegenda('ig-post-legenda', { prefixo: nome });

  const post = el('article', 'ig-post',
    el('header', 'ig-post-topo', avatar(estado.cliente), el('strong', null, nome), el('span', 'ig-espaco'), icone('mais')),
    midia,
    itens.length > 1 && pontos,
    el('div', 'ig-post-acoes',
      el('span', 'ig-acao-linha', icone('coracao'), el('small', null, '1.024')),
      el('span', 'ig-acao-linha', icone('balao'), el('small', null, '48')),
      el('span', 'ig-acao-linha', icone('repostar'), el('small', null, '9')),
      el('span', 'ig-acao-linha', icone('aviao'), el('small', null, '31')),
      icone('salvar')),
    el('div', 'ig-post-texto',
      legenda.elemento,
      el('p', 'ig-post-comentarios', 'Ver todos os 48 comentários'),
      el('p', 'ig-post-data', dataDoFeed(estado.data))));

  tela.append(post);
  // Mudou a ordem ou um arquivo: continua na mesma posição, sem animar.
  if (itens.length > 1) irPara(estado.posicaoCarrossel ?? 0, false);

  return {
    atualizarTexto() { legenda.definir(estado.legenda.trim()); },
    recortar: () => legenda.recortar(),
    parar() { videos.forEach((v) => v.pause()); },
  };
}

// ---------------------------------------------------------------- componente

/**
 * @param {HTMLElement} alvo
 * @param {{ guias?: boolean }} opcoes  guias = mostrar a opção "Áreas cobertas" (só a Bea)
 */
export function criarPrevia(alvo, { guias: comGuias = false } = {}) {
  const botaoInterface = el('button', 'previa-alternar', 'Ocultar interface');
  botaoInterface.type = 'button';
  botaoInterface.setAttribute('aria-pressed', 'false');
  const botaoGuias = el('button', 'previa-alternar', 'Áreas cobertas');
  botaoGuias.type = 'button';
  botaoGuias.setAttribute('aria-pressed', 'false');
  botaoGuias.hidden = !comGuias;

  const controles = el('div', 'previa-controles', botaoInterface, botaoGuias);
  const tela = el('div', 'previa-tela');
  // O Instagram não mostra legenda no Story: o texto fica embaixo, de referência.
  const legendaStory = el('div', 'previa-legenda-story');
  const raiz = el('div', 'previa', controles, tela, legendaStory);
  alvo.replaceChildren(raiz);

  botaoInterface.addEventListener('click', () => {
    const limpa = raiz.classList.toggle('sem-interface');
    botaoInterface.setAttribute('aria-pressed', String(limpa));
    botaoInterface.textContent = limpa ? 'Mostrar interface' : 'Ocultar interface';
    if (!limpa) montada?.recortar();
  });
  botaoGuias.addEventListener('click', () => {
    const ligadas = raiz.classList.toggle('com-guias');
    botaoGuias.setAttribute('aria-pressed', String(ligadas));
  });

  const estado = { formato: 'post', midias: [], legenda: '', cliente: null, data: null, drive: '' };
  let montada = null;
  let chave = '';
  // Mudou a largura (girar o celular, abrir a lateral): o corte da legenda muda junto.
  let larguraAnterior = 0;
  new ResizeObserver(([entrada]) => {
    const largura = Math.round(entrada.contentRect.width);
    if (largura === larguraAnterior) return;
    larguraAnterior = largura;
    montada?.recortar();
  }).observe(tela);

  return {
    /** Atualiza só o que mudou: digitar a legenda não recarrega os vídeos. */
    atualizar(novo) {
      Object.assign(estado, novo);
      const novaChave = JSON.stringify([estado.formato, estado.data, estado.cliente?.instagram,
        estado.cliente?.foto_perfil, estado.midias.map((m) => [m.arquivo_url, m.expira_em])]);
      if (novaChave !== chave) {
        chave = novaChave;
        montada?.parar();
        tela.replaceChildren();
        const tipo = estado.formato;
        raiz.dataset.formato = tipo;
        controles.hidden = tipo === 'post' || tipo === 'carrossel';
        montada = tipo === 'reels' ? montarReels(estado, tela)
          : tipo === 'story' ? montarStory(estado, tela)
          : montarFeed(estado, tela);
      }
      montada.atualizarTexto();
      const texto = estado.legenda.trim();
      legendaStory.hidden = estado.formato !== 'story' || !texto;
      legendaStory.replaceChildren(
        el('p', 'previa-legenda-story-aviso', 'Legenda (o Instagram não mostra legenda no Story)'),
        el('p', 'previa-legenda-story-texto', textoComTags(texto)));
    },
  };
}
