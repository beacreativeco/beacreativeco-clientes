// Número de mensagens novas da Bea na aba "Mensagens" do cliente (ligado por ui.js em toda
// página do cliente), atualizado na hora pelo tempo real.
import { supabase } from './supabase.js';

let contador;

export async function iniciarAvisosCliente() {
  const link = document.querySelector('.painel-nav a[href="/cliente/mensagens/"]');
  if (!link) return;
  contador = document.createElement('span');
  contador.className = 'nao-lidas';
  contador.hidden = true;
  link.append(contador);

  await recontar();
  window.addEventListener('conversa-lida', () => recontar());
  supabase.channel('avisos-cliente')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, () => recontar())
    .subscribe();
}

async function recontar() {
  const { data, error } = await supabase.rpc('conversas_nao_lidas');
  if (error) return console.error(error);
  const total = data.reduce((soma, c) => soma + c.quantidade, 0);
  contador.textContent = total > 99 ? '99+' : String(total);
  contador.hidden = total === 0;
  contador.setAttribute('aria-label', `${total} não ${total === 1 ? 'lida' : 'lidas'}`);
}
