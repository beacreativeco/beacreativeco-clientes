// Aba Mensagens do cliente: a conversa com a Bea, direto (sem lista). No celular ela ocupa
// a tela toda, sem topo nem barra de baixo, e a caixa de texto acompanha o teclado.
import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina } from './ui.js';
import { criarConversa, acompanharTeclado } from './conversa.js';

iniciarPagina('cliente', async ({ perfil }) => {
  document.getElementById('sair').addEventListener('click', sair);
  document.body.classList.add('conversa-aberta');
  acompanharTeclado();

  // Nome e foto da Bea no topo e nos balões dela. Se falhar, fica só "Bea".
  const { data: bea, error } = await supabase.rpc('perfil_bea').maybeSingle();
  if (error) console.error(error);
  document.getElementById('conversa-nome').textContent = bea?.nome || 'Bea';
  const foto = document.getElementById('conversa-foto');
  foto.setAttribute('aria-hidden', 'true');
  foto.textContent = (bea?.nome || 'Bea').charAt(0).toUpperCase();
  if (bea?.foto_url) {
    const img = Object.assign(document.createElement('img'), { src: bea.foto_url, alt: '' });
    img.addEventListener('load', () => foto.replaceChildren(img), { once: true });
  }

  const conversa = criarConversa(document.getElementById('conversa'), {
    clienteId: perfil.cliente.id,
    eu: 'cliente',
    tela: true,
    linkDoConteudo: (id) => `/cliente/conteudo/?id=${id}`,
    perfilDoOutro: bea ?? null,
  });
  await conversa.carregar();
});
