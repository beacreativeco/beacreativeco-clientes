// Aba Mensagens do cliente: a conversa com a Bea, direto (sem lista). No celular ela ocupa
// a tela toda, sem topo nem barra de baixo, e a caixa de texto acompanha o teclado.
//   /cliente/mensagens/?conteudo=<id>           só a parte da conversa sobre aquele conteúdo
//   /cliente/mensagens/?conteudo=<id>&ajuste=1  conversa inteira, com o pedido de ajuste pronto
import { supabase, chamarServidor } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';
import { criarConversa, acompanharTeclado } from './conversa.js';

let clienteId;
let bea = null;
let conversa = null;

iniciarPagina('cliente', async ({ perfil }) => {
  document.getElementById('sair').addEventListener('click', sair);
  document.body.classList.add('conversa-aberta');
  acompanharTeclado();
  // Voltar: quem veio de uma página do sistema (ex.: a tela do conteúdo) volta para ela.
  document.querySelector('.mensagens-voltar').addEventListener('click', (e) => {
    if (!document.referrer.startsWith(`${location.origin}/cliente/`)) return;
    e.preventDefault();
    history.back();
  });
  clienteId = perfil.cliente.id;

  // Nome e foto da Bea no topo e nos balões dela. Se falhar, fica só "Bea".
  const { data, error } = await supabase.rpc('perfil_bea').maybeSingle();
  if (error) console.error(error);
  bea = data ?? null;
  document.getElementById('conversa-nome').textContent = bea?.nome || 'Bea';
  const foto = document.getElementById('conversa-foto');
  foto.setAttribute('aria-hidden', 'true');
  foto.textContent = (bea?.nome || 'Bea').charAt(0).toUpperCase();
  if (bea?.foto_url) {
    const img = Object.assign(document.createElement('img'), { src: bea.foto_url, alt: '' });
    img.addEventListener('load', () => foto.replaceChildren(img), { once: true });
  }

  const busca = new URLSearchParams(location.search);
  const conteudo = busca.get('conteudo');
  if (conteudo && busca.get('ajuste')) {
    // Veio do "Pedir ajuste": a conversa inteira, com o conteúdo anexado. Recarregar a página
    // não abre o pedido de novo.
    history.replaceState(null, '', '/cliente/mensagens/');
    await abrir(null);
    await conversa.pedirAjuste(conteudo);
  } else {
    await abrir(conteudo);
  }
});

window.addEventListener('popstate', () => abrir(new URLSearchParams(location.search).get('conteudo')).catch(console.error));

async function abrir(conteudoId) {
  conversa?.fechar();
  conversa = criarConversa(document.getElementById('conversa'), {
    clienteId,
    conteudoId,
    eu: 'cliente',
    tela: true,
    linkDoConteudo: (id) => `/cliente/conteudo/?id=${id}`,
    perfilDoOutro: bea,
    aoVerTudo: () => {
      history.pushState(null, '', '/cliente/mensagens/');
      abrir(null).catch(console.error);
    },
    // A próxima mensagem depois do "Pedir ajuste" vira o pedido (texto, áudio ou imagem).
    pedirAjuste: async (mensagem, id) => {
      const { error } = await supabase.rpc('pedir_ajuste', {
        p_conteudo_id: id,
        p_tipo: mensagem.tipo,
        p_texto: mensagem.texto ?? null,
        p_arquivo_url: mensagem.arquivo_url ?? null,
        p_duracao_s: mensagem.duracao_s ?? null,
        p_onda: mensagem.onda ?? null,
      });
      if (error) throw error;
      avisar('Pedido de ajuste enviado para a Bea.');
      // Pasta dos arquivos e cartão do Trello (não trava a tela; a próxima chamada acerta).
      chamarServidor('/api/conteudo/organizar', { metodo: 'POST', corpo: { conteudo_id: id } }).catch(console.error);
    },
  });
  await conversa.carregar();
}
