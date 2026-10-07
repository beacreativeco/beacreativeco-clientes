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
      // Já está com esta conversa aberta (do cliente ou do conteúdo): ela mesma mostra a mensagem.
      const busca = new URLSearchParams(location.search);
      const naConversa = location.pathname.startsWith('/admin/mensagens/') && busca.get('cliente') === m.cliente_id;
      const noConteudo = location.pathname.startsWith('/admin/conteudo/') && m.conteudo_id && busca.get('id') === m.conteudo_id;
      if ((naConversa || noConteudo) && !document.hidden) return;
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
  const [cliente, conteudo] = await Promise.all([
    supabase.from('clientes').select('nome').eq('id', m.cliente_id).maybeSingle(),
    m.conteudo_id ? supabase.from('conteudos').select('titulo').eq('id', m.conteudo_id).maybeSingle() : {},
  ]);
  const quem = cliente.data?.nome ?? 'Cliente';
  const titulo = conteudo.data?.titulo ? ` em "${conteudo.data.titulo}"` : '';
  const resumo = m.tipo === 'aprovacao' ? `${quem} aprovou${titulo}.`
    : m.pedido_ajuste ? `${quem} pediu ajuste${titulo}.`
    : `Nova mensagem de ${quem}${titulo}.`;
  const destino = `/admin/mensagens/?cliente=${m.cliente_id}`;

  avisar(resumo, 'ok', destino);

  // Aba em segundo plano: notificação do navegador (se a Bea permitiu na Caixa de mensagens).
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const n = new Notification('BeaCreative', { body: m.texto ? `${resumo}\n${m.texto.slice(0, 120)}` : resumo, tag: m.cliente_id });
    n.onclick = () => { window.focus(); location.href = destino; };
  }
}
