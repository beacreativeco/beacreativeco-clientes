// Avisos de mensagens no painel da Bea (ligado em toda página da admin por ui.js):
// "Mensagens" com o número de não lidas na navegação, aviso na tela e notificação do
// navegador quando um cliente escreve. As listas ouvem o evento 'mensagens-mudaram'.
import { supabase } from './supabase.js';
import { avisar } from './ui.js';

let contador;

export async function iniciarAvisosAdmin() {
  montarLinkNoTopo();
  await recontar();
  window.addEventListener('conversa-lida', () => recontar());

  supabase.channel('avisos-admin')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, async ({ new: m }) => {
      await recontar();
      if (m.autor !== 'cliente') return;
      // Já está com a conversa deste conteúdo aberta: ela mesma mostra a mensagem.
      const aqui = new URLSearchParams(location.search).get('id');
      if (location.pathname.startsWith('/admin/conteudo/') && aqui === m.conteudo_id && !document.hidden) return;
      await avisarMensagem(m);
    })
    .subscribe();
}

// O link "Mensagens" vem da navegação do painel (ui.js); aqui só entra o contador.
function montarLinkNoTopo() {
  const link = document.querySelector('.painel-nav a[href="/admin/mensagens/"]');
  if (!link || link.querySelector('.nao-lidas')) return;
  contador = document.createElement('span');
  contador.className = 'nao-lidas';
  contador.hidden = true;
  link.append(contador);
}

async function recontar() {
  const { data, error } = await supabase.rpc('conversas_nao_lidas');
  if (error) return console.error(error);
  const total = data.reduce((soma, c) => soma + c.quantidade, 0);
  if (contador) {
    contador.textContent = total > 99 ? '99+' : String(total);
    contador.hidden = total === 0;
    contador.setAttribute('aria-label', `${total} não ${total === 1 ? 'lida' : 'lidas'}`);
  }
  window.dispatchEvent(new CustomEvent('mensagens-mudaram', { detail: data }));
}

async function avisarMensagem(m) {
  const { data: c } = await supabase.from('conteudos')
    .select('titulo, clientes(nome)').eq('id', m.conteudo_id).single();
  const quem = c?.clientes?.nome ?? 'Cliente';
  const titulo = c?.titulo ? ` em "${c.titulo}"` : '';
  const resumo = m.tipo === 'aprovacao' ? `${quem} aprovou${titulo}.`
    : m.pedido_ajuste ? `${quem} pediu ajuste${titulo}.`
    : `Nova mensagem de ${quem}${titulo}.`;
  const destino = `/admin/conteudo/?id=${m.conteudo_id}#conversa`;

  avisar(resumo, 'ok', destino);

  // Aba em segundo plano: notificação do navegador (se a Bea permitiu na Caixa de mensagens).
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const n = new Notification('BeaCreative', { body: m.texto ? `${resumo}\n${m.texto.slice(0, 120)}` : resumo, tag: m.conteudo_id });
    n.onclick = () => { window.focus(); location.href = destino; };
  }
}
