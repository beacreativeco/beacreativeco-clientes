// Caixa de mensagens da Bea: uma linha por conversa, não lidas primeiro em destaque.
import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina } from './ui.js';

iniciarPagina('admin', async () => {
  document.getElementById('sair').addEventListener('click', sair);
  ligarNotificacoes();
  await carregar();
  // avisos-admin.js reconta a cada mensagem nova: a caixa acompanha.
  window.addEventListener('mensagens-mudaram', () => carregar().catch(console.error));
});

async function carregar() {
  const { data, error } = await supabase.rpc('caixa_de_mensagens');
  if (error) throw error;

  const naoLidas = data.reduce((soma, c) => soma + c.nao_lidas, 0);
  document.getElementById('resumo').textContent = naoLidas === 0
    ? 'Tudo lido.'
    : `${naoLidas} ${naoLidas === 1 ? 'mensagem nova' : 'mensagens novas'}.`;
  document.getElementById('caixa-vazia').hidden = data.length > 0;

  const modelo = document.getElementById('modelo-conversa');
  document.getElementById('caixa').replaceChildren(...data.map((c) => {
    const li = modelo.content.firstElementChild.cloneNode(true);
    li.classList.toggle('tem-novas', c.nao_lidas > 0);
    li.querySelector('.caixa-link').href = `/admin/conteudo/?id=${c.conteudo_id}#conversa`;
    li.querySelector('.caixa-cliente').textContent = c.cliente_nome;
    li.querySelector('.caixa-quando').textContent = quando(c.criado_em);
    li.querySelector('.caixa-titulo').textContent = c.titulo;
    li.querySelector('.caixa-previa').textContent = previa(c);
    const badge = li.querySelector('.nao-lidas');
    badge.hidden = c.nao_lidas === 0;
    badge.textContent = String(c.nao_lidas);
    return li;
  }));
}

function previa(c) {
  const voce = c.autor === 'bea' ? 'Você: ' : '';
  if (c.tipo === 'aprovacao') return c.autor === 'bea' ? 'Você aprovou' : '✦ Aprovou o conteúdo';
  if (c.tipo === 'audio') return `${voce}Áudio`;
  if (c.tipo === 'referencia') return `${voce}Imagem`;
  return `${voce}${c.texto ?? ''}`;
}

function quando(iso) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// A permissão do navegador só pode ser pedida num clique da Bea.
function ligarNotificacoes() {
  const botao = document.getElementById('ativar-notificacoes');
  const info = document.getElementById('notificacoes-info');
  if (!('Notification' in window)) return;

  const mostrar = () => {
    botao.hidden = Notification.permission !== 'default';
    info.hidden = Notification.permission === 'default';
    info.textContent = Notification.permission === 'granted'
      ? 'O navegador avisa quando um cliente escrever, mesmo com o painel em outra aba.'
      : 'Os avisos do navegador estão bloqueados. Para liberar, use o cadeado ao lado do endereço do site.';
  };
  botao.addEventListener('click', async () => {
    await Notification.requestPermission();
    mostrar();
  });
  mostrar();
}
