// Meu perfil (cliente): foto e nome de quem aprova, e-mail só para ver (quem troca é a Bea)
// e senha. Foto e senha: perfil-comum.js (iguais aos da Bea).
// Nome: pela função salvar_meu_nome (o cliente não edita o próprio cadastro direto).
import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';
import { ocupado, avisarMudanca, ligarFoto, ligarSenha } from './perfil-comum.js';
import { montarSecaoNotificacoes } from './notificacoes.js';

const $ = (id) => document.getElementById(id);

let perfil; // { nome, foto_url, email }
let desenharFoto;

iniciarPagina('cliente', async ({ session, perfil: acesso }) => {
  montarSecaoNotificacoes(document.getElementById('secao-notificacoes'), avisar).catch(console.error);
  $('sair').addEventListener('click', sair); // só se o menu do avatar não montar
  perfil = {
    nome: acesso.cliente.contato_nome,
    foto_url: acesso.cliente.contato_foto_url,
    email: session.user.email,
  };
  desenharFoto = ligarFoto({
    avatar: $('avatar'), input: $('foto'), remover: $('remover-foto'),
    perfil: () => perfil, aoMudar: (campos) => { perfil = { ...perfil, ...campos }; },
  });
  ligarSenha($('form-senha'), $('esqueci-senha'), () => perfil.email);
  $('nome').value = perfil.nome ?? '';
  $('email-atual').textContent = perfil.email;
  $('form-nome').addEventListener('submit', salvarNome);
});

async function salvarNome(e) {
  e.preventDefault();
  const nome = $('nome').value.trim() || null;
  await ocupado(e.target, async () => {
    const { error } = await supabase.rpc('salvar_meu_nome', { p_nome: nome });
    if (error) {
      console.error(error);
      return avisar(error.code === 'P0001' ? error.message : 'Não foi possível salvar. Tente de novo.', 'erro');
    }
    perfil = { ...perfil, nome };
    avisarMudanca({ nome });
    desenharFoto();
    avisar('Nome salvo.');
  });
}
