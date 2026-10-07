// Meu perfil (Bea): foto, nome, e-mail de acesso, senha e dados da agência.
// Foto e senha: perfil-comum.js (iguais aos do cliente).
// Nome e agência: direto no banco (RLS: só a própria linha de admins; agência só admin).
// E-mail: Supabase Auth (só muda depois do link de confirmação).
import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';
import { ocupado, avisarMudanca, ligarFoto, ligarSenha } from './perfil-comum.js';

const $ = (id) => document.getElementById(id);

let perfil; // { nome, foto_url, email }
let desenharFoto;

iniciarPagina('admin', async ({ session }) => {
  $('sair').addEventListener('click', sair); // só se o menu do avatar não montar
  const [admin, agencia] = await Promise.all([
    supabase.from('admins').select('nome, foto_url').eq('user_id', session.user.id).maybeSingle(),
    supabase.from('agencia').select('nome, whatsapp, instagram, email_contato').maybeSingle(),
  ]);
  if (admin.error) throw admin.error;
  if (agencia.error) throw agencia.error;

  perfil = { ...admin.data, email: session.user.email };
  desenharFoto = ligarFoto({
    avatar: $('avatar'), input: $('foto'), remover: $('remover-foto'),
    perfil: () => perfil, aoMudar: (campos) => { perfil = { ...perfil, ...campos }; },
  });
  ligarSenha($('form-senha'), $('esqueci-senha'), () => perfil.email);
  $('nome').value = perfil.nome ?? '';
  $('email-atual').textContent = perfil.email;
  for (const [campo, valor] of Object.entries(agencia.data ?? {})) {
    const input = $('form-agencia').elements[campo];
    if (input) input.value = valor ?? '';
  }

  $('form-nome').addEventListener('submit', salvarNome);
  $('form-email').addEventListener('submit', trocarEmail);
  $('form-agencia').addEventListener('submit', salvarAgencia);

  // Volta do link de confirmação do e-mail novo.
  if (new URLSearchParams(location.search).has('email')) {
    avisar('E-mail confirmado.');
    history.replaceState(null, '', location.pathname);
  }
});

// ------------------------------------------------------------ nome

async function salvarNome(e) {
  e.preventDefault();
  const nome = $('nome').value.trim() || null;
  await ocupado(e.target, async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('admins').update({ nome }).eq('user_id', session.user.id);
    if (error) {
      console.error(error);
      return avisar('Não foi possível salvar. Tente de novo.', 'erro');
    }
    perfil = { ...perfil, nome };
    avisarMudanca({ nome });
    desenharFoto();
    avisar('Nome salvo.');
  });
}

// ------------------------------------------------------------ e-mail

async function trocarEmail(e) {
  e.preventDefault();
  const campo = $('email');
  const email = campo.value.trim().toLowerCase();
  if (!email || !campo.checkValidity()) return avisar('Confira o e-mail novo.', 'erro');
  if (email === perfil.email.toLowerCase()) return avisar('Esse já é o seu e-mail de acesso.', 'erro');
  await ocupado(e.target, async () => {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${location.origin}/admin/perfil/?email=confirmado` },
    );
    if (error) {
      console.error(error);
      const msg = error.code === 'email_exists'
        ? 'Esse e-mail já é usado por outro acesso do sistema.'
        : 'Não foi possível pedir a troca agora. Tente de novo em instantes.';
      return avisar(msg, 'erro');
    }
    campo.value = '';
    avisar(`Enviamos o link de confirmação para ${email}. Confira também o e-mail atual.`);
  });
}

// ------------------------------------------------------------ agência

async function salvarAgencia(e) {
  e.preventDefault();
  const form = e.target;
  const texto = (campo) => form.elements[campo].value.trim() || null;
  const dados = {
    nome: texto('nome'),
    whatsapp: texto('whatsapp')?.replace(/\D/g, '') || null,
    instagram: texto('instagram')?.replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '') || null,
    email_contato: texto('email_contato')?.toLowerCase() ?? null,
  };
  if (dados.email_contato && !form.elements.email_contato.checkValidity()) return avisar('Confira o e-mail de contato.', 'erro');
  await ocupado(form, async () => {
    const { error } = await supabase.from('agencia')
      .upsert({ id: true, ...dados, atualizado_em: new Date().toISOString() });
    if (error) {
      console.error(error);
      return avisar('Não foi possível salvar. Tente de novo.', 'erro');
    }
    form.elements.whatsapp.value = dados.whatsapp ?? '';
    form.elements.instagram.value = dados.instagram ?? '';
    avisar('Dados da agência salvos.');
  });
}
