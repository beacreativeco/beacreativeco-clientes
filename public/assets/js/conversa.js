// Conversa por conteúdo, estilo WhatsApp (página do cliente e editor da Bea).
// Balões dos dois lados, separação por dia, links clicáveis, tempo real (Supabase
// Realtime) e "lida" quando a conversa está na tela.
import { supabase } from './supabase.js';

const LIMITE_TEXTO = 2000;

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

  const raiz = el('div', 'conversa', lista, avisoAjuste, erro, form);
  alvo.replaceChildren(raiz);

  const vistas = new Set();   // ids já desenhados (a própria mensagem volta pelo Realtime)
  let ultimoDia = '';
  let modoAjuste = false;

  // ------------------------------------------------------------ desenhar

  function balao(m) {
    if (m.tipo === 'aprovacao') {
      const quem = m.autor === eu ? 'Você aprovou' : `${nomeDoOutro} aprovou`;
      return el('p', 'conversa-evento', `✦ ${quem}, ${hora(m.criado_em)}`);
    }
    const lado = m.autor === eu ? 'meu' : 'outro';
    const corpo = el('div', `conversa-balao conversa-${lado}`);
    if (m.pedido_ajuste) corpo.append(el('span', 'conversa-etiqueta', 'Pedido de ajuste'));
    if (m.texto) corpo.append(el('p', 'conversa-texto', textoComLinks(m.texto)));
    corpo.append(el('span', 'conversa-hora', hora(m.criado_em)));
    return corpo;
  }

  function adicionar(m) {
    if (vistas.has(m.id)) return false;
    vistas.add(m.id);
    vazia.remove();
    const dia = new Date(m.criado_em).toDateString();
    if (dia !== ultimoDia) {
      ultimoDia = dia;
      lista.append(el('p', 'conversa-dia', rotuloDoDia(m.criado_em)));
    }
    lista.append(balao(m));
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
    modoAjuste = ligado;
    avisoAjuste.hidden = !ligado;
    raiz.classList.toggle('pedindo-ajuste', ligado);
    campo.placeholder = ligado ? 'O que você quer mudar?' : 'Mensagem';
  }
  cancelarAjuste.addEventListener('click', () => definirModoAjuste(false));

  // ------------------------------------------------------------ carregar e tempo real

  async function carregar() {
    const { data, error } = await supabase.from('mensagens')
      .select('id, autor, tipo, texto, arquivo_url, duracao_s, pedido_ajuste, criado_em')
      .eq('conteudo_id', conteudoId).order('criado_em');
    if (error) throw error;
    data.forEach(adicionar);
    if (!vistas.size) lista.append(vazia);
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
