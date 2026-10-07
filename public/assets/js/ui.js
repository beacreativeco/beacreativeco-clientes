import { protegerPagina } from './auth.js';
import { supabase } from './supabase.js';
// Importado já no carregamento: o beforeinstallprompt do navegador pode chegar cedo.
import { iniciarInstalacao } from './instalar.js';

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
    if (area === 'admin') {
      montarNavegacaoAdmin();
      // Se o menu falhar, o "Sair" antigo continua no topo: a página abre mesmo assim.
      await montarPerfilAdmin(acesso.session).catch(console.error);
    } else {
      await montarPerfilCliente(acesso).catch(console.error);
    }
    carregando.hidden = true;
    app.hidden = false;
    // Rodapé com "Sobre o sistema" (versão, novidades e créditos), nos dois lados.
    import('./sobre.js').then((m) => m.ligarRodapeSobre(app)).catch(console.error);
    // App na tela inicial: registra o service worker e agenda o convite para instalar.
    iniciarInstalacao();
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

// Avatar com o menu (Meu perfil, Sobre o sistema, Sair) no lugar do "Sair" do topo.
// Nome e foto vêm de `admins`; se falhar, o menu aparece com as iniciais do e-mail.
async function montarPerfilAdmin(session) {
  const { data, error } = await supabase.from('admins')
    .select('nome, foto_url').eq('user_id', session.user.id).maybeSingle();
  if (error) console.error(error);
  const { montarMenuPerfil } = await import('./perfil-menu.js');
  montarMenuPerfil({ ...data, email: session.user.email }, { linkPerfil: '/admin/perfil/' });
}

// Cliente: o mesmo menu, com o nome e a foto de quem aprova (já vêm no perfil do login).
async function montarPerfilCliente({ session, perfil }) {
  const { montarMenuPerfil } = await import('./perfil-menu.js');
  montarMenuPerfil({
    nome: perfil.cliente.contato_nome,
    foto_url: perfil.cliente.contato_foto_url,
    email: session.user.email,
  }, { linkPerfil: '/cliente/perfil/' });
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
