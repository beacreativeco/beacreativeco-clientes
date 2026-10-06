import { protegerPagina } from './auth.js';

/**
 * Abre uma página logada: confere o acesso, roda `montar` e troca o
 * "Carregando…" pelo conteúdo. Se algo falhar, mostra o erro com
 * um botão para tentar de novo em vez de ficar carregando pra sempre.
 * @param {'admin'|'cliente'} area
 * @param {(acesso: {session, perfil}) => Promise<void>|void} montar
 */
export async function iniciarPagina(area, montar) {
  const carregando = document.getElementById('carregando');
  const app = document.getElementById('app');

  try {
    const acesso = await protegerPagina(area);
    if (!acesso) return; // já está redirecionando
    await montar(acesso);
    if (area === 'admin') montarNavegacaoAdmin();
    carregando.hidden = true;
    app.hidden = false;
    // Rodapé com "Sobre o sistema" (versão, novidades e créditos), nos dois lados.
    import('./sobre.js').then((m) => m.ligarRodapeSobre(app)).catch(console.error);
    // Painel da Bea: contador de não lidas, avisos e notificação de mensagens novas.
    if (area === 'admin') {
      import('./avisos-admin.js').then((m) => m.iniciarAvisosAdmin()).catch(console.error);
    }
  } catch (err) {
    console.error(err);
    mostrarFalhaAoCarregar(carregando);
  }
}

// Painel da Bea: Clientes · Calendário · Mensagens, logo abaixo do topo.
// O contador de não lidas no "Mensagens" é pendurado por avisos-admin.js.
const NAVEGACAO_ADMIN = [
  { texto: 'Clientes', href: '/admin/', ativo: (p) => p === '/admin/' || p.startsWith('/admin/cliente/') },
  { texto: 'Calendário', href: '/admin/calendario/', ativo: (p) => p.startsWith('/admin/calendario/') },
  { texto: 'Mensagens', href: '/admin/mensagens/', ativo: (p) => p.startsWith('/admin/mensagens/') },
];

function montarNavegacaoAdmin() {
  const topo = document.querySelector('.topo');
  if (!topo || document.querySelector('.painel-nav')) return;
  const nav = document.createElement('nav');
  nav.className = 'painel-nav';
  nav.setAttribute('aria-label', 'Painel');
  for (const item of NAVEGACAO_ADMIN) {
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.texto;
    if (item.ativo(location.pathname)) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  topo.after(nav);
}

function mostrarFalhaAoCarregar(container) {
  const monograma = container.querySelector('.marca-monograma');
  container.replaceChildren(...(monograma ? [monograma] : []));
  container.classList.add('falha');

  const texto = document.createElement('p');
  texto.textContent = 'Não foi possível carregar a página. Confira sua internet e tente de novo.';

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'botao botao-compacto';
  botao.textContent = 'Tentar de novo';
  botao.addEventListener('click', () => window.location.reload());

  container.append(texto, botao);
  container.hidden = false;
}

/**
 * Aviso rápido no rodapé da tela (salvo, convite enviado, erro...).
 * Usa o <div id="toast" class="toast" role="status" hidden> da página (ou cria um).
 * Com `link`, o aviso inteiro leva até lá (ex.: mensagem nova de um cliente).
 */
let timerToast;
export function avisar(texto, tipo = 'ok', link = null) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = Object.assign(document.createElement('div'), { id: 'toast', className: 'toast', hidden: true });
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
  }
  if (link) {
    const a = Object.assign(document.createElement('a'), { href: link, textContent: texto, className: 'toast-link' });
    toast.replaceChildren(a);
  } else {
    toast.textContent = texto;
  }
  toast.className = 'toast ' + tipo;
  toast.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { toast.hidden = true; }, tipo === 'erro' ? 7000 : 4000);
}
