// Notificações push (Web Push): ativar neste aparelho, desligar, testar e ver os aparelhos.
// A permissão do navegador só é pedida no toque em "Ativar notificações", nunca sozinha.
// No iPhone/iPad só funciona com o sistema instalado na tela de início (iOS 16.4+).
// Quem envia é o servidor (functions/_lib/webpush.js); quem mostra é o sw.js.
import { supabase, chamarServidor } from './supabase.js';
import { VAPID_PUBLIC_KEY } from './config.js';
import { jaInstalado, ehIos, instalarAgora } from './instalar.js';

const suportaPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * O que dá para fazer neste aparelho:
 * 'ativo' | 'pode-ativar' | 'bloqueado' | 'instalar-iphone' | 'sem-suporte'
 */
export async function situacaoNesteAparelho() {
  if (ehIos() && !jaInstalado()) return 'instalar-iphone';
  if (!suportaPush()) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  const inscricao = await inscricaoAtual();
  return inscricao && Notification.permission === 'granted' ? 'ativo' : 'pode-ativar';
}

async function inscricaoAtual() {
  const registro = await navigator.serviceWorker.getRegistration('/');
  return registro ? registro.pushManager.getSubscription() : null;
}

// "Chrome no Android", "Safari no iPhone"… para a lista de aparelhos.
function nomeDoAparelho() {
  const ua = navigator.userAgent;
  const sistema = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (ehIos() && /Mac/.test(ua)) ? 'iPad'
    : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'computador';
  const navegador = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Navegador';
  return `${jaInstalado() ? 'App' : navegador} no ${sistema}`;
}

const chaveDoServidor = () => {
  const b64 = VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

async function registrar(inscricao) {
  const { keys } = inscricao.toJSON();
  const { error } = await supabase.rpc('registrar_aparelho', {
    p_endpoint: inscricao.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_nome: nomeDoAparelho(),
  });
  if (error) throw error;
}

/** "Ativar notificações": pede a permissão (este toque), inscreve e guarda o aparelho. */
export async function ativar() {
  if (!suportaPush()) throw Object.assign(new Error('Este navegador não recebe notificações.'), { code: 'P0001' });
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    throw Object.assign(new Error(permissao === 'denied'
      ? 'As notificações foram bloqueadas. Para liberar, use o cadeado ao lado do endereço do site (no app instalado, os ajustes do aparelho).'
      : 'As notificações não foram ativadas.'), { code: 'P0001' });
  }
  await navigator.serviceWorker.register('/sw.js');
  const registro = await navigator.serviceWorker.ready;
  const inscricao = await registro.pushManager.getSubscription()
    ?? await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveDoServidor() });
  await registrar(inscricao);
  window.dispatchEvent(new CustomEvent('notificacoes-mudaram'));
}

/** Desliga neste aparelho: cancela a inscrição no navegador e tira do banco. */
export async function desativar() {
  const inscricao = await inscricaoAtual();
  if (inscricao) {
    await supabase.from('push_aparelhos').delete().eq('endpoint', inscricao.endpoint);
    await inscricao.unsubscribe().catch(console.error);
  }
  window.dispatchEvent(new CustomEvent('notificacoes-mudaram'));
}

/**
 * Ao abrir uma página logada: se este aparelho já está inscrito, confirma no banco (o
 * navegador pode trocar a inscrição sozinho, ou a linha pode ter sido removida em outro
 * aparelho). Nunca pede permissão.
 */
export async function sincronizar() {
  if (!suportaPush() || Notification.permission !== 'granted') return;
  const inscricao = await inscricaoAtual();
  if (inscricao) await registrar(inscricao);
}

/** Ao sair da conta: este aparelho para de receber avisos dela. */
export async function esquecerEsteAparelho() {
  if (!suportaPush()) return;
  const inscricao = await inscricaoAtual().catch(() => null);
  if (!inscricao) return;
  await supabase.from('push_aparelhos').delete().eq('endpoint', inscricao.endpoint);
  await inscricao.unsubscribe().catch(() => {});
}

// A mensagem do servidor já vem pronta para a pessoa ler (ex.: nenhum aparelho ativado).
export const enviarTeste = () =>
  chamarServidor(`/api/push/teste?voltar=${encodeURIComponent(location.pathname)}`, { metodo: 'POST' })
    .catch((err) => { throw Object.assign(err, { code: 'P0001' }); });

// ---------------------------------------------------------------- seção do perfil

function el(tag, classe, ...filhos) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f);
  return n;
}

function botao(texto, classe = 'botao-secundario') {
  const b = el('button', classe, texto);
  b.type = 'button';
  return b;
}

const TEXTOS = {
  ativo: 'Ativadas neste aparelho. Os avisos chegam mesmo com o sistema fechado.',
  'pode-ativar': 'Receba um aviso na barra de notificações quando chegar mensagem ou novidade nos conteúdos, mesmo com o sistema fechado.',
  bloqueado: 'As notificações estão bloqueadas neste navegador. Para liberar, use o cadeado ao lado do endereço do site (no app instalado, os ajustes do aparelho) e volte aqui.',
  'instalar-iphone': 'No iPhone e no iPad, as notificações só funcionam com o sistema instalado na tela de início (dá para instalar pelo Safari, pelo Chrome, pelo Edge ou pelo Firefox). Toque em "Como instalar" para ver o passo a passo do seu navegador; depois abra pelo ícone e ative aqui.',
  'sem-suporte': 'Este navegador não recebe notificações. No computador, use o Chrome, o Edge, o Firefox ou o Safari; no celular, o Chrome (Android) ou o app instalado (iPhone).',
};

/**
 * Monta a seção "Notificações" do perfil (Bea e cliente) dentro de `alvo`.
 * @param {(texto: string, tipo?: string) => void} avisar
 */
export function montarSecaoNotificacoes(alvo, avisar) {
  const estado = el('p', 'notificacoes-estado');
  const acoes = el('div', 'notificacoes-acoes');
  const tituloAparelhos = el('h3', 'notificacoes-subtitulo', 'Aparelhos com notificações');
  const lista = el('ul', 'notificacoes-aparelhos');
  const blocoAparelhos = el('div', null, tituloAparelhos, lista);
  alvo.append(estado, acoes, blocoAparelhos);

  async function ocupado(b, acao) {
    b.disabled = true;
    try {
      await acao();
    } catch (err) {
      console.error(err);
      avisar(err.code === 'P0001' || err.status ? err.message : 'Não foi possível agora. Confira sua internet e tente de novo.', 'erro');
    } finally {
      b.disabled = false;
      desenhar().catch(console.error);
    }
  }

  async function desenhar() {
    const situacao = await situacaoNesteAparelho();
    estado.textContent = TEXTOS[situacao];
    estado.classList.toggle('notificacoes-ativo', situacao === 'ativo');

    const botoes = [];
    if (situacao === 'pode-ativar') {
      const ligar = botao('Ativar notificações', 'botao botao-compacto');
      ligar.addEventListener('click', () => ocupado(ligar, async () => {
        await ativar();
        avisar('Notificações ativadas neste aparelho.');
      }));
      botoes.push(ligar);
    }
    if (situacao === 'ativo') {
      const testar = botao('Enviar notificação de teste', 'botao botao-compacto');
      testar.addEventListener('click', () => ocupado(testar, async () => {
        const { entregues } = await enviarTeste();
        avisar(entregues === 1 ? 'Teste enviado. Deve chegar em instantes.' : `Teste enviado para ${entregues} aparelhos.`);
      }));
      const desligar = botao('Desligar neste aparelho', 'botao-link');
      desligar.addEventListener('click', () => ocupado(desligar, async () => {
        await desativar();
        avisar('Notificações desligadas neste aparelho.');
      }));
      botoes.push(testar, desligar);
    }
    if (situacao === 'instalar-iphone') {
      const instalar = botao('Como instalar');
      instalar.addEventListener('click', () => instalarAgora());
      botoes.push(instalar);
    }
    acoes.replaceChildren(...botoes);
    acoes.hidden = !botoes.length;

    const { data, error } = await supabase.from('push_aparelhos')
      .select('id, endpoint, nome, criado_em, usado_em').order('criado_em');
    if (error) throw error;
    const atual = (await inscricaoAtual().catch(() => null))?.endpoint;
    blocoAparelhos.hidden = !data.length;
    lista.replaceChildren(...data.map((a) => {
      const desde = new Date(a.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const remover = botao('Remover', 'botao-link');
      remover.setAttribute('aria-label', `Remover ${a.nome || 'aparelho'}`);
      remover.addEventListener('click', () => ocupado(remover, async () => {
        if (a.endpoint === atual) await desativar();
        else {
          const { error: erro } = await supabase.from('push_aparelhos').delete().eq('id', a.id);
          if (erro) throw erro;
        }
        avisar('Aparelho removido. Ele não recebe mais notificações.');
      }));
      return el('li', 'notificacoes-aparelho',
        el('span', 'notificacoes-aparelho-info',
          el('strong', null, a.nome || 'Aparelho', a.endpoint === atual ? ' (este)' : ''),
          el('span', null, `Desde ${desde}`)),
        remover);
    }));
  }

  window.addEventListener('notificacoes-mudaram', () => desenhar().catch(console.error));
  return desenhar();
}
