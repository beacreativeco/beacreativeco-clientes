// Conversa da Bea com um cliente, estilo WhatsApp (aba Mensagens dos dois lados), ou só a
// parte dela sobre um conteúdo (filtro, na tela do conteúdo). Cada mensagem pode carregar
// o conteúdo de que fala, mostrado como um cartão no balão.
// Balões dos dois lados, separação por dia, links clicáveis, tempo real (Supabase
// Realtime) e "lida" quando a conversa está na tela.
import { supabase } from './supabase.js';
import { avisar } from './ui.js';
import { otimizarImagem } from './otimizar.js';
import { SITUACOES, SITUACOES_CLIENTE, expirou } from './conteudos.js';
import { gravar, gravacaoDisponivel, motivoDoErro, relogio, LIMITE_SEGUNDOS, BARRAS_ONDA } from './gravador.js';

const LIMITE_TEXTO = 2000;
// Os mesmos prazos das funções do banco (editar_mensagem e apagar_mensagem), que são quem decide.
const MINUTOS_PARA_EDITAR = 15;
const HORAS_PARA_APAGAR = 48;
const SEGURAR_MS = 500;

function el(tag, classe, ...filhos) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f);
  return n;
}

function icone(caminho) {
  const s = el('span', 'conversa-icone');
  s.setAttribute('aria-hidden', 'true');
  // Strings fixas deste arquivo (nunca dado de usuário).
  s.innerHTML = `<svg viewBox="0 0 24 24">${caminho}</svg>`;
  return s;
}
const ICONE_ENVIAR = '<path d="M4 12 20 4l-4.5 16-3.7-6.8z"/><path d="m11.8 13.2 3.9-4.4"/>';
const ICONE_MICROFONE = '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>';
const ICONE_LIXEIRA = '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="m6.5 7 1 13h9l1-13"/>';
const ICONE_PLAY = '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>';
const ICONE_PAUSA = '<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>';

// Um áudio tocando por vez na página.
let tocandoAgora = null;

// Áudios antigos (de antes da onda guardada): barras iguais, baixinhas.
const ONDA_PADRAO = Array(BARRAS_ONDA).fill(22);

// Player do balão: play/pausa, a onda do áudio (preenche conforme toca; tocar ou
// arrastar nela pula) e o tempo. Por cima da onda fica um range invisível, que dá
// arrastar, teclado e leitor de tela de graça.
function playerDeAudio(src, duracaoSalva, ondaSalva) {
  const audio = el('audio');
  audio.preload = 'metadata';
  audio.src = src;
  const botao = el('button', 'audio-play', icone(ICONE_PLAY));
  botao.type = 'button';
  botao.setAttribute('aria-label', 'Tocar áudio');
  const barras = (ondaSalva?.length ? ondaSalva : ONDA_PADRAO).map((altura) => {
    const b = el('span');
    b.style.setProperty('--altura', `${Math.max(12, altura)}%`);
    return b;
  });
  const barra = el('input', 'audio-barra');
  barra.type = 'range';
  barra.min = '0';
  barra.step = '0.1';
  barra.value = '0';
  barra.setAttribute('aria-label', 'Posição do áudio');
  const onda = el('div', 'audio-onda', el('div', 'audio-barras', barras), barra);
  const tempo = el('span', 'audio-tempo');
  const player = el('div', 'audio-player', botao, onda, tempo, audio);

  // WEBM gravado no navegador às vezes diz "Infinity" de duração: vale a que foi salva.
  const duracao = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(duracaoSalva) || 0);
  let tocadas = -1;
  const mostrar = () => {
    const fracao = Math.min(1, audio.currentTime / (duracao() || 1));
    barra.max = String(duracao() || 1);
    barra.value = String(audio.currentTime);
    const agora = Math.round(fracao * barras.length);
    if (agora !== tocadas) {
      barras.forEach((b, i) => b.classList.toggle('tocada', i < agora));
      tocadas = agora;
    }
    tempo.textContent = relogio(audio.paused && audio.currentTime === 0 ? duracao() : audio.currentTime);
  };
  // timeupdate vem só ~4 vezes por segundo: tocando, a onda acompanha quadro a quadro.
  let quadro = 0;
  const acompanhar = () => {
    mostrar();
    if (!audio.paused) quadro = requestAnimationFrame(acompanhar);
  };
  mostrar();
  audio.addEventListener('loadedmetadata', mostrar);
  audio.addEventListener('timeupdate', mostrar);
  audio.addEventListener('play', () => {
    if (tocandoAgora && tocandoAgora !== audio) tocandoAgora.pause();
    tocandoAgora = audio;
    botao.replaceChildren(icone(ICONE_PAUSA));
    botao.setAttribute('aria-label', 'Pausar áudio');
    player.classList.add('tocando');
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(acompanhar);
  });
  audio.addEventListener('pause', () => {
    botao.replaceChildren(icone(ICONE_PLAY));
    botao.setAttribute('aria-label', 'Tocar áudio');
    player.classList.remove('tocando');
    cancelAnimationFrame(quadro);
  });
  audio.addEventListener('ended', () => { audio.currentTime = 0; mostrar(); });
  audio.addEventListener('error', () => {
    player.replaceWith(el('p', 'conversa-expirado', 'Áudio expirado'));
  }, { once: true });
  botao.addEventListener('click', () => (audio.paused ? audio.play().catch(console.error) : audio.pause()));
  barra.addEventListener('input', () => {
    audio.currentTime = Number(barra.value);
    mostrar();
  });
  return player;
}

const ICONE_ANEXAR = '<path d="m20.2 11.4-8 8a5 5 0 0 1-7.1-7.1l8.4-8.4a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.7-7.7"/>';

// Imagem aberta em tela cheia (uma para a página toda).
let visor;
function abrirImagem(src) {
  if (!visor) {
    visor = el('dialog', 'conversa-visor');
    const img = el('img');
    img.alt = 'Imagem de referência';
    const fechar = el('button', 'conversa-visor-fechar', '×');
    fechar.type = 'button';
    fechar.setAttribute('aria-label', 'Fechar');
    fechar.addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor) visor.close(); });
    visor.append(img, fechar);
    document.body.append(visor);
  }
  visor.querySelector('img').src = src;
  visor.showModal();
}

// Links no texto viram clicáveis, sem innerHTML.
function textoComLinks(texto) {
  const frag = document.createDocumentFragment();
  let ultimo = 0;
  for (const m of texto.matchAll(/\bhttps?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]/gi)) {
    const a = el('a', null, m[0]);
    a.href = m[0];
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
    frag.append(texto.slice(ultimo, m.index), a);
    ultimo = m.index + m[0].length;
  }
  frag.append(texto.slice(ultimo));
  return frag;
}

function hora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function rotuloDoDia(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

// ------------------------------------------------------------ cartão do conteúdo

const CAMPOS_CARTAO = 'id, titulo, status, versao_atual, midias(tipo, arquivo_url, versao, ordem, expira_em)';
const ICONE_VIDEO = '<path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/>';

// Miniatura: a primeira imagem da versão atual. Vídeo, expirado ou sem arquivo: um quadro
// com o símbolo (sem carregar vídeo só para a miniatura).
function miniaturaDoConteudo(info) {
  const caixa = el('span', 'conversa-cartao-mini');
  const primeira = (info?.midias ?? [])
    .filter((m) => m.versao === info.versao_atual)
    .sort((a, b) => a.ordem - b.ordem)[0];
  if (primeira?.tipo === 'imagem' && !expirou(primeira.expira_em)) {
    const img = el('img');
    img.src = primeira.arquivo_url;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove(), { once: true });
    caixa.append(img);
  } else {
    caixa.append(primeira?.tipo === 'video' ? icone(ICONE_VIDEO) : '✦');
  }
  return caixa;
}

/**
 * @param {HTMLElement} alvo
 * @param {{
 *   clienteId: string,                      // de quem é a conversa
 *   conteudoId?: string,                    // só a parte da conversa sobre este conteúdo
 *   eu: 'cliente' | 'bea',
 *   tela?: boolean,                         // ocupa a altura toda (aba Mensagens)
 *   linkDoConteudo?: (id: string) => string, // para onde o cartão do conteúdo leva
 *   pedirAjuste?: (mensagem: {tipo: string, texto?: string}) => Promise<void>,
 *   aoChegar?: (mensagem: object) => void,   // mensagem nova da outra pessoa (tempo real)
 * }} opcoes
 */
export function criarConversa(alvo, { clienteId, conteudoId = null, eu, tela = false, linkDoConteudo, pedirAjuste, aoChegar, perfilDoOutro }) {
  const outro = eu === 'bea' ? 'cliente' : 'bea';
  const nomeDoOutro = eu === 'bea' ? 'Cliente' : 'Bea';
  const situacoes = eu === 'bea' ? SITUACOES : SITUACOES_CLIENTE;
  // Na conversa filtrada todas as mensagens são do mesmo conteúdo: sem cartão.
  const comCartoes = !conteudoId;

  const lista = el('div', 'conversa-lista');
  lista.setAttribute('role', 'log');
  lista.setAttribute('aria-live', 'polite');
  const vazia = el('p', 'conversa-vazia', conteudoId
    ? 'Nenhuma mensagem sobre este conteúdo ainda.'
    : eu === 'bea'
      ? 'Nenhuma mensagem ainda. Escreva para o cliente por aqui.'
      : 'Alguma dúvida ou ideia? Escreva para a Bea por aqui.');

  const avisoAjuste = el('div', 'conversa-aviso-ajuste',
    el('p', null, 'Conte o que você quer mudar. Sua próxima mensagem vira o pedido de ajuste.'));
  const cancelarAjuste = el('button', 'botao-link', 'Cancelar');
  cancelarAjuste.type = 'button';
  avisoAjuste.append(cancelarAjuste);
  avisoAjuste.hidden = true;

  const avisoEdicao = el('div', 'conversa-aviso-ajuste conversa-aviso-edicao', el('p', null, 'Editando mensagem'));
  const cancelarEdicao = el('button', 'botao-link', 'Cancelar');
  cancelarEdicao.type = 'button';
  avisoEdicao.append(cancelarEdicao);
  avisoEdicao.hidden = true;

  const campo = el('textarea', 'conversa-campo');
  campo.rows = 1;
  campo.maxLength = LIMITE_TEXTO;
  campo.placeholder = 'Mensagem';
  campo.setAttribute('aria-label', 'Mensagem');
  const enviar = el('button', 'conversa-enviar', icone(ICONE_ENVIAR));
  enviar.type = 'submit';
  enviar.setAttribute('aria-label', 'Enviar');
  const erro = el('p', 'conversa-erro');
  erro.setAttribute('role', 'alert');
  erro.hidden = true;
  const anexar = el('button', 'conversa-anexar', icone(ICONE_ANEXAR));
  anexar.type = 'button';
  anexar.setAttribute('aria-label', 'Anexar imagem de referência');
  const seletor = el('input');
  seletor.type = 'file';
  seletor.accept = 'image/*';
  seletor.multiple = true;
  seletor.hidden = true;
  const microfone = el('button', 'conversa-enviar conversa-microfone', icone(ICONE_MICROFONE));
  microfone.type = 'button';
  microfone.setAttribute('aria-label', 'Gravar áudio');

  // Barra de gravação (no lugar da caixa de escrever enquanto grava).
  const cancelarGravacao = el('button', 'conversa-anexar', icone(ICONE_LIXEIRA));
  cancelarGravacao.type = 'button';
  cancelarGravacao.setAttribute('aria-label', 'Cancelar gravação');
  const tempoGravacao = el('span', 'gravando-tempo', '0:00');
  const avisoGravacao = el('span', 'gravando-aviso');
  avisoGravacao.setAttribute('aria-live', 'polite');
  const ondaAoVivo = el('canvas', 'gravando-onda');
  ondaAoVivo.setAttribute('aria-hidden', 'true');
  const enviarGravacao = el('button', 'conversa-enviar', icone(ICONE_ENVIAR));
  enviarGravacao.type = 'button';
  enviarGravacao.setAttribute('aria-label', 'Enviar áudio');
  const barraGravando = el('div', 'conversa-gravando', avisoGravacao, cancelarGravacao,
    el('span', 'gravando-ponto'), tempoGravacao, ondaAoVivo, enviarGravacao);
  barraGravando.hidden = true;

  const form = el('form', 'conversa-escrever', anexar, seletor, campo, enviar, microfone);

  const menu = el('div', 'conversa-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const raiz = el('div', `conversa${tela ? ' conversa-tela' : ''}`, lista, avisoAjuste, avisoEdicao, erro, form, barraGravando, menu);
  alvo.replaceChildren(raiz);

  // id → { m, no, inicio }: a própria mensagem volta pelo Realtime (não duplica) e
  // edição/exclusão trocam o balão no lugar. `no` é o balão já desenhado (null: desenhar).
  const mensagens = new Map();
  // Conteúdos dos cartões: id → dados (null: o cliente não pode ver, voltou para a Bea).
  const conteudos = new Map();
  let ultimoDia = '';
  let modoAjuste = false;
  let editando = null;

  // ------------------------------------------------------------ desenhar

  const minutosDesde = (iso) => (Date.now() - new Date(iso).getTime()) / 60000;
  const protegida = (m) => m.tipo === 'aprovacao' || m.pedido_ajuste || m.apagada_em;
  const podeEditar = (m) => m.autor === eu && !protegida(m) && m.tipo === 'texto'
    && minutosDesde(m.criado_em) <= MINUTOS_PARA_EDITAR;
  const podeApagar = (m) => m.autor === eu && !protegida(m) && minutosDesde(m.criado_em) <= HORAS_PARA_APAGAR * 60;
  const podeCopiar = (m) => Boolean(m.texto) && !m.apagada_em;
  const temMenu = (m) => m.tipo !== 'aprovacao' && (podeCopiar(m) || podeApagar(m));

  // Nome e foto de quem está do outro lado (ex.: a Bea, para o cliente), no primeiro balão
  // de cada sequência dela, como nos grupos do WhatsApp.
  function autor() {
    let foto = null;
    if (perfilDoOutro.foto_url) {
      const img = el('img');
      img.src = perfilDoOutro.foto_url;
      img.alt = '';
      foto = el('span', 'conversa-autor-foto', img);
      img.addEventListener('error', () => foto.remove(), { once: true });
    }
    return el('span', 'conversa-autor', foto, perfilDoOutro.nome || nomeDoOutro);
  }

  // Cartão do conteúdo da mensagem: miniatura, título e situação; tocar abre o conteúdo.
  function cartao(id) {
    const info = conteudos.get(id);
    if (!info) {
      const indisponivel = el('span', 'conversa-cartao conversa-cartao-off', miniaturaDoConteudo(null),
        el('span', 'conversa-cartao-info', el('span', 'conversa-cartao-titulo', 'Conteúdo em revisão pela Bea')));
      indisponivel.dataset.conteudo = id;
      return indisponivel;
    }
    const situacao = situacoes[info.status];
    const a = el('a', 'conversa-cartao', miniaturaDoConteudo(info),
      el('span', 'conversa-cartao-info',
        el('span', 'conversa-cartao-titulo', info.titulo),
        situacao ? el('span', `situacao ${situacao.classe}`, situacao.texto) : null));
    a.href = linkDoConteudo?.(id) ?? '#';
    a.dataset.conteudo = id;
    return a;
  }

  function balao(m, inicio = false) {
    if (m.tipo === 'aprovacao') {
      const quem = m.autor === eu ? 'Você aprovou' : `${perfilDoOutro?.nome || nomeDoOutro} aprovou`;
      const titulo = comCartoes && m.conteudo_id ? conteudos.get(m.conteudo_id)?.titulo : null;
      const evento = el('p', 'conversa-evento', `✦ ${quem}${titulo ? ` “${titulo}”` : ''}, ${hora(m.criado_em)}`);
      evento.dataset.id = m.id;
      return evento;
    }
    const lado = m.autor === eu ? 'meu' : 'outro';
    const corpo = el('div', `conversa-balao conversa-${lado}`);
    corpo.dataset.id = m.id;
    if (inicio && perfilDoOutro && lado === 'outro') corpo.append(autor());
    if (m.apagada_em) {
      corpo.classList.add('conversa-apagada');
      corpo.append(el('p', 'conversa-texto', m.autor === eu ? 'Você apagou esta mensagem' : 'Mensagem apagada'));
    } else {
      if (m.pedido_ajuste) corpo.append(el('span', 'conversa-etiqueta', 'Pedido de ajuste'));
      if (comCartoes && m.conteudo_id) corpo.append(cartao(m.conteudo_id));
      if (m.tipo === 'audio') corpo.classList.add('conversa-com-audio');
      // Já apagado pela exclusão automática (aprovados/, 30 dias depois): só o aviso.
      const sumiu = m.arquivo_url && m.arquivo_expira_em && new Date(m.arquivo_expira_em) <= new Date();
      if (sumiu) corpo.append(el('p', 'conversa-expirado', m.tipo === 'audio' ? 'Áudio expirado' : 'Imagem expirada'));
      else if (m.tipo === 'referencia' && m.arquivo_url) corpo.append(miniatura(m.arquivo_url));
      else if (m.tipo === 'audio' && m.arquivo_url) corpo.append(playerDeAudio(m.arquivo_url, m.duracao_s, m.onda));
      if (m.texto) corpo.append(el('p', 'conversa-texto', textoComLinks(m.texto)));
    }
    corpo.append(el('span', 'conversa-hora', `${m.editada_em && !m.apagada_em ? 'editada ' : ''}${hora(m.criado_em)}`));
    if (temMenu(m)) {
      const mais = el('button', 'conversa-mais', '⋯');
      mais.type = 'button';
      mais.setAttribute('aria-label', 'Opções da mensagem');
      mais.setAttribute('aria-haspopup', 'menu');
      corpo.append(mais);
    }
    return corpo;
  }

  // Miniatura no balão; um toque abre inteira. Arquivo que não existe mais
  // (exclusão automática do armazenamento): aviso no lugar de imagem quebrada.
  function miniatura(src) {
    const botao = el('button', 'conversa-imagem');
    botao.type = 'button';
    botao.setAttribute('aria-label', 'Abrir imagem de referência');
    const img = el('img');
    img.src = src;
    img.alt = 'Imagem de referência';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      botao.replaceWith(el('p', 'conversa-expirado', 'Imagem expirada'));
    }, { once: true });
    botao.append(img);
    botao.addEventListener('click', () => abrirImagem(src));
    return botao;
  }

  // Apagadas seguidas (de qualquer pessoa) viram uma linha discreta só.
  function linhaDeApagadas(quantas) {
    const linha = el('p', 'conversa-apagadas', quantas === 1 ? 'Mensagem apagada' : `${quantas} mensagens apagadas`);
    linha.dataset.quantas = String(quantas);
    return linha;
  }

  // Põe uma mensagem no fim da lista (com o dia, se mudou). Um balão da outra pessoa começa
  // uma sequência (com o nome) depois de um balão meu, de um evento, do dia ou de apagadas.
  function anexarNoFim(item) {
    const dia = new Date(item.m.criado_em).toDateString();
    if (dia !== ultimoDia) {
      ultimoDia = dia;
      lista.append(el('p', 'conversa-dia', rotuloDoDia(item.m.criado_em)));
    }
    const ultimo = lista.lastElementChild;
    if (item.m.apagada_em) {
      item.no = null;
      if (ultimo?.classList.contains('conversa-apagadas')) {
        ultimo.replaceWith(linhaDeApagadas(Number(ultimo.dataset.quantas) + 1));
      } else {
        lista.append(linhaDeApagadas(1));
      }
      return;
    }
    const inicio = !ultimo?.classList.contains('conversa-outro');
    if (!item.no || item.inicio !== inicio) item.no = balao(item.m, inicio);
    item.inicio = inicio;
    lista.append(item.no);
  }

  // Redesenha a lista inteira (os balões já prontos são reaproveitados). Usado ao carregar
  // e quando uma mensagem é apagada (ela entra num grupo de apagadas).
  function desenharTudo() {
    lista.replaceChildren();
    ultimoDia = '';
    const ordem = [...mensagens.values()].sort((a, b) => a.m.criado_em.localeCompare(b.m.criado_em));
    ordem.forEach(anexarNoFim);
    if (!ordem.length) lista.append(vazia);
  }

  // Edição ou exclusão (minha ou da outra pessoa, pelo Realtime): troca o balão no lugar.
  function atualizar(m) {
    const atual = mensagens.get(m.id);
    if (!atual) return;
    const novo = { ...atual.m, ...m };
    const apagouAgora = Boolean(novo.apagada_em) && !atual.m.apagada_em;
    atual.m = novo;
    if (menuDe === m.id) fecharMenu();
    if (editando?.id === m.id && novo.apagada_em) sairDaEdicao();
    if (apagouAgora) {
      desenharTudo();
      return;
    }
    if (!atual.no) return;
    const no = balao(novo, atual.inicio);
    atual.no.replaceWith(no);
    atual.no = no;
  }

  // Mensagem nova (enviada aqui ou chegando pelo Realtime): sempre a mais recente.
  function adicionar(m) {
    if (mensagens.has(m.id)) return false;
    vazia.remove();
    const item = { m, no: null, inicio: false };
    mensagens.set(m.id, item);
    anexarNoFim(item);
    return true;
  }

  // Busca os conteúdos dos cartões que ainda não estão na memória, ou de novo quando a
  // situação de um deles muda (aprovação ou pedido de ajuste chegando).
  async function carregarConteudos(ids, deNovo = false) {
    if (!comCartoes) return;
    const faltam = [...new Set(ids.filter((id) => id && (deNovo || !conteudos.has(id))))];
    if (!faltam.length) return;
    const { data, error } = await supabase.from('conteudos').select(CAMPOS_CARTAO).in('id', faltam);
    if (error) return console.error(error);
    for (const id of faltam) conteudos.set(id, data.find((c) => c.id === id) ?? null);
    if (deNovo) {
      lista.querySelectorAll('.conversa-cartao').forEach((velho) => {
        if (faltam.includes(velho.dataset.conteudo)) velho.replaceWith(cartao(velho.dataset.conteudo));
      });
    }
  }

  const pertoDoFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
  const rolarProFim = () => { lista.scrollTop = lista.scrollHeight; };

  // Quem está no fim da conversa continua no fim quando a lista muda de tamanho: a página
  // aparecendo depois de carregar, o teclado do celular abrindo ou uma imagem terminando
  // de carregar. Quem subiu para ler algo antigo não é puxado para baixo.
  let colado = true;
  lista.addEventListener('scroll', () => { colado = pertoDoFim(); }, { passive: true });
  new ResizeObserver(() => { if (colado) rolarProFim(); }).observe(lista);
  lista.addEventListener('load', () => { if (colado) rolarProFim(); }, true);

  // ------------------------------------------------------------ lida

  // Só com a conversa na tela; quem acabou de enviar com certeza leu (forcar).
  // Sem setTimeout: em aba de fundo o Chrome segura timers por até 1 minuto.
  // Uma chamada por vez; o que chegar no meio vira uma única repetição no fim.
  let marcandoAgora = false;
  let repetir = false;
  function marcarLida(forcar = false) {
    if (document.hidden && !forcar) return;
    if (marcandoAgora) {
      repetir = true;
      return;
    }
    marcandoAgora = true;
    // Na conversa filtrada, só as mensagens deste conteúdo ficam lidas; na inteira, todas.
    const chamada = conteudoId
      ? supabase.rpc('marcar_conversa_lida', { p_conteudo_id: conteudoId })
      : supabase.rpc('marcar_conversa_do_cliente_lida', { p_cliente_id: clienteId });
    chamada
      .then(({ error }) => {
        if (error) return console.error(error);
        // Os contadores de não lidas (topo do painel) se atualizam.
        window.dispatchEvent(new CustomEvent('conversa-lida', { detail: { clienteId, conteudoId } }));
      })
      .finally(() => {
        marcandoAgora = false;
        if (repetir) {
          repetir = false;
          marcarLida(true);
        }
      });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) marcarLida(); });

  // ------------------------------------------------------------ enviar

  function mostrarErro(texto) {
    erro.textContent = texto;
    erro.hidden = !texto;
  }

  function ajustarAltura() {
    campo.style.height = 'auto';
    campo.style.height = `${Math.min(campo.scrollHeight, 160)}px`;
    campo.style.overflowY = campo.scrollHeight > 160 ? 'auto' : 'hidden'; // barra só quando passa do limite
  }
  // Caixa vazia: microfone. Com texto (ou editando): enviar. Como no WhatsApp.
  function trocarBotao() {
    const comTexto = campo.value.trim() !== '' || Boolean(editando);
    enviar.hidden = !comTexto;
    microfone.hidden = comTexto;
  }
  campo.addEventListener('input', () => { ajustarAltura(); trocarBotao(); });

  // Computador: Enter envia e Shift+Enter quebra linha. No celular, Enter quebra linha.
  const temTeclado = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  campo.addEventListener('keydown', (e) => {
    if (temTeclado && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto) return;
    mostrarErro('');
    enviar.disabled = true;
    try {
      if (editando) {
        const { data, error } = await supabase.rpc('editar_mensagem', { p_mensagem_id: editando.id, p_texto: texto });
        if (error) throw error;
        atualizar(data);
        sairDaEdicao();
        return;
      }
      if (modoAjuste) {
        await pedirAjuste({ tipo: 'texto', texto });
        definirModoAjuste(false);
        await carregar();
      } else {
        const { data, error } = await supabase.from('mensagens')
          .insert({ cliente_id: clienteId, conteudo_id: conteudoId, autor: eu, tipo: 'texto', texto })
          .select().single();
        if (error) throw error;
        adicionar(data);
      }
      campo.value = '';
      ajustarAltura();
      trocarBotao();
      rolarProFim();
      marcarLida(true);
    } catch (err) {
      console.error(err);
      mostrarErro(err.code === 'P0001' ? err.message : 'A mensagem não foi enviada. Confira sua internet e tente de novo.');
    } finally {
      enviar.disabled = false;
    }
  });

  // ------------------------------------------------------------ imagens de referência

  async function subirArquivo(blob) {
    const { data: { session } } = await supabase.auth.getSession();
    // Com conteúdo, o arquivo fica na pasta dele; sem, na conversa do cliente (some em 30 dias).
    const destino = conteudoId ? `conteudo_id=${conteudoId}` : `cliente_id=${clienteId}`;
    const resp = await fetch(`/api/conversa/arquivo?${destino}`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type, Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: blob,
    });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw Object.assign(new Error(corpo.erro || 'O arquivo não foi enviado.'), { code: 'P0001' });
    // Tamanho e validade vão junto na mensagem (espaço usado no painel e "expirado" na tela).
    return { arquivo_url: corpo.arquivo_url, arquivo_mb: corpo.arquivo_mb ?? null, arquivo_expira_em: corpo.arquivo_expira_em ?? null };
  }

  // Manda uma mensagem com arquivo; no modo "Pedir ajuste", ela vira o pedido.
  async function enviarComArquivo(mensagem) {
    if (modoAjuste) {
      await pedirAjuste(mensagem);
      definirModoAjuste(false);
      await carregar();
      return;
    }
    const { data, error } = await supabase.from('mensagens')
      .insert({ cliente_id: clienteId, conteudo_id: conteudoId, autor: eu, ...mensagem }).select().single();
    if (error) throw error;
    adicionar(data);
  }

  async function enviarImagens(arquivos) {
    mostrarErro('');
    for (const arquivo of arquivos) {
      const espera = el('div', 'conversa-balao conversa-meu conversa-enviando', el('p', 'conversa-texto', 'Enviando imagem…'));
      lista.append(espera);
      vazia.remove();
      rolarProFim();
      try {
        const leve = await otimizarImagem(arquivo);
        const arquivo = await subirArquivo(leve);
        espera.remove();
        await enviarComArquivo({ tipo: 'referencia', ...arquivo });
        rolarProFim();
        marcarLida(true);
      } catch (err) {
        console.error(err);
        espera.remove();
        const heic = /heic|heif/i.test(arquivo.type || arquivo.name);
        mostrarErro(heic ? 'Fotos HEIC não abrem neste navegador. Exporte como JPG e envie de novo.'
          : err.code === 'P0001' && err.message ? err.message : `${arquivo.name}: a imagem não foi enviada. Tente de novo.`);
      }
    }
  }

  // ------------------------------------------------------------ áudio (tocar para gravar, tocar para enviar)

  let gravacao = null;

  function mostrarGravando(ligado) {
    form.hidden = ligado;
    barraGravando.hidden = !ligado;
    raiz.classList.toggle('gravando', ligado);
  }

  // Ondas ao vivo: uma barra por medição (a cada 100 ms), a mais nova na direita,
  // andando para a esquerda. Microfone sem captar nada = tracinhos parados.
  const BARRA_PX = 3;
  const VAO_PX = 2;
  let niveisAoVivo = [];
  function desenharOndaAoVivo() {
    const largura = ondaAoVivo.clientWidth;
    const altura = ondaAoVivo.clientHeight;
    if (!largura || !altura) return; // ainda escondida
    const dpr = window.devicePixelRatio || 1;
    if (ondaAoVivo.width !== Math.round(largura * dpr)) {
      ondaAoVivo.width = Math.round(largura * dpr);
      ondaAoVivo.height = Math.round(altura * dpr);
    }
    const ctx = ondaAoVivo.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);
    ctx.fillStyle = getComputedStyle(ondaAoVivo).color;
    const cabem = Math.floor(largura / (BARRA_PX + VAO_PX));
    if (niveisAoVivo.length > cabem) niveisAoVivo = niveisAoVivo.slice(-cabem);
    niveisAoVivo.forEach((nivel, i) => {
      const h = Math.max(3, nivel * altura);
      const x = largura - (niveisAoVivo.length - i) * (BARRA_PX + VAO_PX);
      ctx.beginPath();
      ctx.roundRect(x, (altura - h) / 2, BARRA_PX, h, BARRA_PX / 2);
      ctx.fill();
    });
  }

  microfone.addEventListener('click', async () => {
    mostrarErro('');
    if (!gravacaoDisponivel()) return mostrarErro(motivoDoErro());
    if (microfone.disabled || gravacao) return; // dois toques enquanto pede permissão: uma gravação só
    microfone.disabled = true;
    tempoGravacao.textContent = '0:00';
    avisoGravacao.textContent = '';
    niveisAoVivo = [];
    try {
      gravacao = await gravar({
        aoNivel: (nivel) => {
          niveisAoVivo.push(nivel);
          desenharOndaAoVivo();
        },
        aoTempo: (s) => {
          tempoGravacao.textContent = relogio(s);
          const faltam = LIMITE_SEGUNDOS - s;
          avisoGravacao.textContent = faltam <= 15 && faltam > 0 ? `Faltam ${Math.ceil(faltam)} s` : '';
        },
        aoLimite: () => {
          avisoGravacao.textContent = 'Limite de 3 minutos. Envie ou cancele.';
          raiz.classList.add('gravacao-no-limite');
        },
      });
      mostrarGravando(true);
      enviarGravacao.focus();
    } catch (err) {
      console.error(err);
      gravacao = null;
      mostrarErro(motivoDoErro(err));
    } finally {
      microfone.disabled = false;
    }
  });

  cancelarGravacao.addEventListener('click', () => {
    gravacao?.cancelar();
    gravacao = null;
    raiz.classList.remove('gravacao-no-limite');
    mostrarGravando(false);
  });

  enviarGravacao.addEventListener('click', async () => {
    if (!gravacao) return;
    const atual = gravacao;
    gravacao = null;
    raiz.classList.remove('gravacao-no-limite');
    mostrarGravando(false);
    const espera = el('div', 'conversa-balao conversa-meu conversa-enviando', el('p', 'conversa-texto', 'Enviando áudio…'));
    lista.append(espera);
    vazia.remove();
    rolarProFim();
    try {
      const { arquivo, duracao, onda } = await atual.concluir();
      if (duracao < 1) throw Object.assign(new Error('Áudio curto demais. Toque no microfone, fale e depois envie.'), { code: 'P0001' });
      const enviado = await subirArquivo(arquivo);
      espera.remove();
      await enviarComArquivo({ tipo: 'audio', ...enviado, duracao_s: duracao, onda });
      rolarProFim();
      marcarLida(true);
    } catch (err) {
      console.error(err);
      espera.remove();
      mostrarErro(err.code === 'P0001' && err.message ? err.message : 'O áudio não foi enviado. Tente de novo.');
    }
  });

  anexar.addEventListener('click', () => seletor.click());
  seletor.addEventListener('change', () => {
    const arquivos = [...seletor.files];
    seletor.value = '';
    if (arquivos.length) enviarImagens(arquivos);
  });

  function definirModoAjuste(ligado) {
    if (ligado) sairDaEdicao();
    modoAjuste = ligado;
    avisoAjuste.hidden = !ligado;
    raiz.classList.toggle('pedindo-ajuste', ligado);
    campo.placeholder = ligado ? 'O que você quer mudar?' : 'Mensagem';
  }
  cancelarAjuste.addEventListener('click', () => definirModoAjuste(false));

  function entrarNaEdicao(m) {
    definirModoAjuste(false);
    editando = m;
    avisoEdicao.hidden = false;
    raiz.classList.add('editando');
    campo.value = m.texto;
    ajustarAltura();
    trocarBotao();
    campo.focus();
  }

  function sairDaEdicao() {
    if (!editando) return;
    editando = null;
    avisoEdicao.hidden = true;
    raiz.classList.remove('editando');
    campo.value = '';
    ajustarAltura();
    trocarBotao();
  }
  cancelarEdicao.addEventListener('click', sairDaEdicao);

  // ------------------------------------------------------------ menu (⋯, botão direito ou segurar)

  let menuDe = null;

  function fecharMenu() {
    menu.hidden = true;
    menuDe = null;
  }

  function itemDoMenu(texto, acao, perigo = false) {
    const b = el('button', `conversa-menu-item${perigo ? ' perigo' : ''}`, texto);
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.addEventListener('click', acao);
    return b;
  }

  function abrirMenu(no) {
    const m = mensagens.get(no.dataset.id)?.m;
    if (!m || !temMenu(m)) return;
    if (menuDe === m.id && !menu.hidden) return;
    menuDe = m.id;

    const itens = [];
    if (podeCopiar(m)) itens.push(itemDoMenu('Copiar texto', () => copiar(m)));
    if (podeEditar(m)) itens.push(itemDoMenu('Editar', () => { fecharMenu(); entrarNaEdicao(m); }));
    if (podeApagar(m)) {
      itens.push(itemDoMenu('Apagar', () => {
        // Confirmação no próprio menu: apagar vale para os dois lados.
        menu.replaceChildren(
          el('p', 'conversa-menu-pergunta', 'Apagar para os dois?'),
          itemDoMenu('Apagar', () => apagar(m), true),
          itemDoMenu('Cancelar', fecharMenu));
        posicionar(no);
        menu.querySelector('.perigo').focus();
      }, true));
    }
    menu.replaceChildren(...itens);
    menu.hidden = false;
    posicionar(no);
    menu.firstElementChild?.focus({ preventScroll: true });
  }

  // Embaixo do balão; perto do fim da conversa, em cima. Do lado de quem escreveu.
  function posicionar(no) {
    const r = no.getBoundingClientRect();
    const base = raiz.getBoundingClientRect();
    menu.style.left = '';
    menu.style.right = '';
    if (no.classList.contains('conversa-meu')) menu.style.right = `${base.right - r.right}px`;
    else menu.style.left = `${r.left - base.left}px`;
    const embaixo = r.bottom - base.top + 4;
    const cabeEmbaixo = embaixo + menu.offsetHeight < lista.getBoundingClientRect().bottom - base.top;
    menu.style.top = `${cabeEmbaixo ? embaixo : Math.max(4, r.top - base.top - menu.offsetHeight - 4)}px`;
  }

  async function copiar(m) {
    fecharMenu();
    try {
      await navigator.clipboard.writeText(m.texto);
      avisar('Texto copiado.');
    } catch {
      avisar('Não foi possível copiar. Selecione o texto e copie.', 'erro');
    }
  }

  async function apagar(m) {
    fecharMenu();
    mostrarErro('');
    try {
      if (m.arquivo_url) {
        // Com áudio ou imagem: o servidor confere no banco (com o seu login) e tira o arquivo do armazenamento.
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch('/api/conversa/apagar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
          body: JSON.stringify({ mensagem_id: m.id }),
        });
        const corpo = await resp.json().catch(() => ({}));
        if (!resp.ok) throw Object.assign(new Error(corpo.erro), { code: 'P0001' });
      } else {
        const { error } = await supabase.rpc('apagar_mensagem', { p_mensagem_id: m.id });
        if (error) throw error;
      }
      atualizar({ id: m.id, apagada_em: new Date().toISOString(), texto: null, arquivo_url: null });
    } catch (err) {
      console.error(err);
      mostrarErro(err.code === 'P0001' && err.message ? err.message : 'Não foi possível apagar. Confira sua internet e tente de novo.');
    }
  }

  lista.addEventListener('click', (e) => {
    const mais = e.target.closest('.conversa-mais');
    if (mais) abrirMenu(mais.closest('.conversa-balao'));
  });
  // Botão direito no computador; no Android, segurar também dispara contextmenu.
  lista.addEventListener('contextmenu', (e) => {
    const no = e.target.closest('.conversa-balao');
    const m = no && mensagens.get(no.dataset.id)?.m;
    if (!m || !temMenu(m)) return;
    if (e.target.closest('a') && e.pointerType !== 'touch') return; // links: menu do navegador
    e.preventDefault();
    abrirMenu(no);
  });
  // Segurar o dedo (o iPhone não dispara contextmenu). Mexer o dedo cancela, para não brigar com a rolagem.
  let segurando = null;
  lista.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const no = e.target.closest('.conversa-balao');
    if (!no) return;
    segurando = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        segurando = null;
        navigator.vibrate?.(10);
        abrirMenu(no);
      }, SEGURAR_MS),
    };
  });
  const soltar = () => {
    if (!segurando) return;
    clearTimeout(segurando.timer);
    segurando = null;
  };
  lista.addEventListener('pointermove', (e) => {
    if (segurando && Math.hypot(e.clientX - segurando.x, e.clientY - segurando.y) > 10) soltar();
  });
  lista.addEventListener('pointerup', soltar);
  lista.addEventListener('pointercancel', soltar);
  lista.addEventListener('scroll', fecharMenu, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('.conversa-mais')) fecharMenu();
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!menu.hidden) fecharMenu();
    else if (editando) sairDaEdicao();
  });

  trocarBotao();

  // ------------------------------------------------------------ carregar e tempo real

  async function carregar() {
    const { data, error } = await supabase.from('mensagens')
      .select('id, conteudo_id, autor, tipo, texto, arquivo_url, arquivo_expira_em, duracao_s, onda, pedido_ajuste, criado_em, editada_em, apagada_em')
      .eq(conteudoId ? 'conteudo_id' : 'cliente_id', conteudoId ?? clienteId).order('criado_em');
    if (error) throw error;
    await carregarConteudos(data.map((m) => m.conteudo_id));
    mensagens.clear();
    for (const m of data) mensagens.set(m.id, { m, no: null, inicio: false });
    desenharTudo();
    rolarProFim();
    marcarLida();
  }

  const filtro = conteudoId ? `conteudo_id=eq.${conteudoId}` : `cliente_id=eq.${clienteId}`;
  const canal = supabase.channel(`conversa-${conteudoId ?? clienteId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensagens', filter: filtro },
      async ({ new: m }) => {
        // Aprovação ou pedido de ajuste: a situação do conteúdo mudou (o cartão acompanha).
        const mudouSituacao = m.tipo === 'aprovacao' || m.pedido_ajuste;
        await carregarConteudos([m.conteudo_id], mudouSituacao);
        const estavaNoFim = pertoDoFim();
        if (!adicionar(m)) return;
        if (estavaNoFim || m.autor === eu) rolarProFim();
        if (m.autor === outro) {
          marcarLida();
          aoChegar?.(m);
        }
      })
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'mensagens', filter: filtro },
      ({ new: m }) => atualizar(m))
    .subscribe();
  window.addEventListener('pagehide', () => supabase.removeChannel(canal));

  return {
    carregar,
    /** Para de ouvir o tempo real (ao trocar de conversa sem sair da página). */
    fechar: () => supabase.removeChannel(canal),
    /** "Pedir ajuste": a próxima mensagem vira o pedido. */
    pedirAjuste() {
      definirModoAjuste(true);
      // Rola até o título da conversa (centralizar cortava o título com o celular deitado).
      (alvo.closest('section') ?? raiz).scrollIntoView({ behavior: 'smooth', block: 'start' });
      campo.focus({ preventScroll: true });
    },
    sairDoModoAjuste: () => definirModoAjuste(false),
  };
}

/**
 * Conversa em tela cheia no celular: a parte visível da tela (acima do teclado) vira
 * --vv-altura e --vv-topo no <html>, e o CSS prende a conversa nela. No Android a viewport
 * com interactive-widget=resizes-content já encolhe a página; no iPhone (Safari ignora essa
 * opção) é isto que mantém a caixa de texto logo acima do teclado.
 */
export function acompanharTeclado() {
  const vv = window.visualViewport;
  if (!vv) return;
  const raiz = document.documentElement;
  const ajustar = () => {
    raiz.style.setProperty('--vv-altura', `${vv.height}px`);
    raiz.style.setProperty('--vv-topo', `${vv.offsetTop}px`);
  };
  vv.addEventListener('resize', ajustar);
  vv.addEventListener('scroll', ajustar);
  ajustar();
}
