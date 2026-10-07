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

  // Topo e navegação aparecem na hora, antes de conferir o login: na troca de tela só o
  // conteúdo muda (o topo fica parado na transição).
  montarNavegacao(area);

  try {
    const acesso = await protegerPagina(area);
    if (!acesso) return; // já está redirecionando
    await montar(acesso);
    if (area === 'admin') {
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

// Navegação dos dois lados: abas no topo (computador) e barra embaixo (celular), o mesmo
// elemento; o CSS decide onde ele fica. A aba ativa leva o indicador (que desliza na troca).
// O contador de não lidas no "Mensagens" da Bea é pendurado por avisos-admin.js.
const ICONES_NAV = {
  clientes: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.9-3.1 3-4.8 5.5-4.8s4.6 1.7 5.5 4.8"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8"/><path d="M17.5 14.6c1.5.6 2.6 2 3 4.4"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  mensagens: '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.3-4.4a8.5 8.5 0 1 1 15.7-4.5z"/>',
  aprovar: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
  aprovados: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  perfil: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/>',
};

const NAVEGACAO = {
  admin: [
    { texto: 'Clientes', href: '/admin/', icone: 'clientes', ativo: (p) => p === '/admin/' || p.startsWith('/admin/cliente/') || p.startsWith('/admin/conteudo/') },
    { texto: 'Calendário', href: '/admin/calendario/', icone: 'calendario', ativo: (p) => p.startsWith('/admin/calendario/') },
    { texto: 'Mensagens', href: '/admin/mensagens/', icone: 'mensagens', ativo: (p) => p.startsWith('/admin/mensagens/') },
  ],
  cliente: [
    { texto: 'Para aprovar', href: '/cliente/', icone: 'aprovar', ativo: (p, ver) => (p === '/cliente/' && ver !== 'aprovados') || p.startsWith('/cliente/conteudo/') },
    { texto: 'Aprovados', href: '/cliente/?ver=aprovados', icone: 'aprovados', ativo: (p, ver) => p === '/cliente/' && ver === 'aprovados' },
    { texto: 'Perfil', href: '/cliente/perfil/', icone: 'perfil', ativo: (p) => p.startsWith('/cliente/perfil/') },
  ],
};

function montarNavegacao(area) {
  const topo = document.querySelector('.topo');
  if (!topo || topo.querySelector('.painel-nav')) return;
  const ver = new URLSearchParams(location.search).get('ver');
  const nav = document.createElement('nav');
  nav.className = 'painel-nav';
  nav.setAttribute('aria-label', area === 'admin' ? 'Painel' : 'Seus conteúdos');
  for (const item of NAVEGACAO[area]) {
    const a = document.createElement('a');
    a.href = item.href;
    const icone = document.createElement('span');
    icone.className = 'nav-icone';
    icone.setAttribute('aria-hidden', 'true');
    // Desenhos fixos deste arquivo (nunca dado de usuário).
    icone.innerHTML = `<svg viewBox="0 0 24 24">${ICONES_NAV[item.icone]}</svg>`;
    const texto = document.createElement('span');
    texto.className = 'nav-texto';
    texto.textContent = item.texto;
    a.append(icone, texto);
    if (item.ativo(location.pathname, ver)) {
      a.setAttribute('aria-current', 'page');
      const indicador = document.createElement('span');
      indicador.className = 'nav-indicador';
      a.append(indicador);
    }
    nav.append(a);
  }
  topo.querySelector('.titulo').after(nav);
  document.body.classList.add('com-navegacao');
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
