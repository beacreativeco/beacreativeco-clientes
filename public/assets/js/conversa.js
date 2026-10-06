// Conversa por conteúdo, estilo WhatsApp (página do cliente e editor da Bea).
// Balões dos dois lados, separação por dia, links clicáveis, tempo real (Supabase
// Realtime) e "lida" quando a conversa está na tela.
import { supabase } from './supabase.js';
import { avisar } from './ui.js';

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

/**
 * @param {HTMLElement} alvo
 * @param {{
 *   conteudoId: string,
 *   eu: 'cliente' | 'bea',
 *   pedirAjuste?: (mensagem: {tipo: string, texto?: string}) => Promise<void>,
 *   aoChegar?: (mensagem: object) => void,   // mensagem nova da outra pessoa (tempo real)
 * }} opcoes
 */
export function criarConversa(alvo, { conteudoId, eu, pedirAjuste, aoChegar }) {
  const outro = eu === 'bea' ? 'cliente' : 'bea';
  const nomeDoOutro = eu === 'bea' ? 'Cliente' : 'Bea';

  const lista = el('div', 'conversa-lista');
  lista.setAttribute('role', 'log');
  lista.setAttribute('aria-live', 'polite');
  const vazia = el('p', 'conversa-vazia', eu === 'bea'
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
  const form = el('form', 'conversa-escrever', campo, enviar);

  const menu = el('div', 'conversa-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const raiz = el('div', 'conversa', lista, avisoAjuste, avisoEdicao, erro, form, menu);
  alvo.replaceChildren(raiz);

  // id → { m, no }: a própria mensagem volta pelo Realtime (não duplica) e
  // edição/exclusão trocam o balão no lugar.
  const mensagens = new Map();
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

  function balao(m) {
    if (m.tipo === 'aprovacao') {
      const quem = m.autor === eu ? 'Você aprovou' : `${nomeDoOutro} aprovou`;
      return el('p', 'conversa-evento', `✦ ${quem}, ${hora(m.criado_em)}`);
    }
    const lado = m.autor === eu ? 'meu' : 'outro';
    const corpo = el('div', `conversa-balao conversa-${lado}`);
    corpo.dataset.id = m.id;
    if (m.apagada_em) {
      corpo.classList.add('conversa-apagada');
      corpo.append(el('p', 'conversa-texto', m.autor === eu ? 'Você apagou esta mensagem' : 'Mensagem apagada'));
    } else {
      if (m.pedido_ajuste) corpo.append(el('span', 'conversa-etiqueta', 'Pedido de ajuste'));
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

  // Edição ou exclusão (minha ou da outra pessoa, pelo Realtime): troca o balão no lugar.
  function atualizar(m) {
    const atual = mensagens.get(m.id);
    if (!atual) return;
    const novo = { ...atual.m, ...m };
    const no = balao(novo);
    atual.no.replaceWith(no);
    mensagens.set(m.id, { m: novo, no });
    if (menuDe === m.id) fecharMenu();
    if (editando?.id === m.id && novo.apagada_em) sairDaEdicao();
  }

  function adicionar(m) {
    if (mensagens.has(m.id)) return false;
    vazia.remove();
    const dia = new Date(m.criado_em).toDateString();
    if (dia !== ultimoDia) {
      ultimoDia = dia;
      lista.append(el('p', 'conversa-dia', rotuloDoDia(m.criado_em)));
    }
    const no = balao(m);
    mensagens.set(m.id, { m, no });
    lista.append(no);
    return true;
  }

  const pertoDoFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
  const rolarProFim = () => { lista.scrollTop = lista.scrollHeight; };

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
    supabase.rpc('marcar_conversa_lida', { p_conteudo_id: conteudoId })
      .then(({ error }) => {
        if (error) return console.error(error);
        // Os contadores de não lidas (topo do painel) se atualizam.
        window.dispatchEvent(new CustomEvent('conversa-lida', { detail: conteudoId }));
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
  campo.addEventListener('input', ajustarAltura);

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
          .insert({ conteudo_id: conteudoId, autor: eu, tipo: 'texto', texto })
          .select().single();
        if (error) throw error;
        adicionar(data);
      }
      campo.value = '';
      ajustarAltura();
      rolarProFim();
      marcarLida(true);
    } catch (err) {
      console.error(err);
      mostrarErro(err.code === 'P0001' ? err.message : 'A mensagem não foi enviada. Confira sua internet e tente de novo.');
    } finally {
      enviar.disabled = false;
    }
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
    campo.focus();
  }

  function sairDaEdicao() {
    if (!editando) return;
    editando = null;
    avisoEdicao.hidden = true;
    raiz.classList.remove('editando');
    campo.value = '';
    ajustarAltura();
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

  // ------------------------------------------------------------ carregar e tempo real

  async function carregar() {
    const { data, error } = await supabase.from('mensagens')
      .select('id, autor, tipo, texto, arquivo_url, duracao_s, pedido_ajuste, criado_em, editada_em, apagada_em')
      .eq('conteudo_id', conteudoId).order('criado_em');
    if (error) throw error;
    data.forEach(adicionar);
    if (!mensagens.size) lista.append(vazia);
    rolarProFim();
    marcarLida();
  }

  const canal = supabase.channel(`conversa-${conteudoId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `conteudo_id=eq.${conteudoId}` },
      ({ new: m }) => {
        const estavaNoFim = pertoDoFim();
        if (!adicionar(m)) return;
        if (estavaNoFim || m.autor === eu) rolarProFim();
        if (m.autor === outro) {
          marcarLida();
          aoChegar?.(m);
        }
      })
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'mensagens', filter: `conteudo_id=eq.${conteudoId}` },
      ({ new: m }) => atualizar(m))
    .subscribe();
  window.addEventListener('pagehide', () => supabase.removeChannel(canal));

  return {
    carregar,
    /** "Pedir ajuste": a próxima mensagem vira o pedido. */
    pedirAjuste() {
      definirModoAjuste(true);
      raiz.scrollIntoView({ behavior: 'smooth', block: 'center' });
      campo.focus({ preventScroll: true });
    },
    sairDoModoAjuste: () => definirModoAjuste(false),
  };
}
