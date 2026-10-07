// Meu perfil (Bea): foto, nome, e-mail de acesso, senha e dados da agência.
// Foto: recortada em quadrado e comprimida aqui, gravada pelo servidor (/api/perfil/foto).
// Nome e agência: direto no banco (RLS: só a própria linha de admins; agência só admin).
// E-mail e senha: Supabase Auth (o e-mail só muda depois do link de confirmação).
import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';
import { desenharAvatar } from './perfil-menu.js';

const $ = (id) => document.getElementById(id);
const LADO_FOTO = 400;

let perfil; // { nome, foto_url, email }

iniciarPagina('admin', async ({ session }) => {
  $('sair').addEventListener('click', sair); // só se o menu do avatar não montar
  const [admin, agencia] = await Promise.all([
    supabase.from('admins').select('nome, foto_url').eq('user_id', session.user.id).maybeSingle(),
    supabase.from('agencia').select('nome, whatsapp, instagram, email_contato').maybeSingle(),
  ]);
  if (admin.error) throw admin.error;
  if (agencia.error) throw agencia.error;

  perfil = { ...admin.data, email: session.user.email };
  desenharFoto();
  $('nome').value = perfil.nome ?? '';
  $('email-atual').textContent = perfil.email;
  for (const [campo, valor] of Object.entries(agencia.data ?? {})) {
    const input = $('form-agencia').elements[campo];
    if (input) input.value = valor ?? '';
  }

  $('foto').addEventListener('change', trocarFoto);
  $('remover-foto').addEventListener('click', removerFoto);
  $('form-nome').addEventListener('submit', salvarNome);
  $('form-email').addEventListener('submit', trocarEmail);
  $('form-senha').addEventListener('submit', trocarSenha);
  $('form-agencia').addEventListener('submit', salvarAgencia);

  // Volta do link de confirmação do e-mail novo.
  if (new URLSearchParams(location.search).has('email')) {
    avisar('E-mail confirmado.');
    history.replaceState(null, '', location.pathname);
  }
});

function desenharFoto() {
  desenharAvatar($('avatar'), perfil);
  $('remover-foto').hidden = !perfil.foto_url;
}

// Avisa o menu do topo (avatar e nome) sem recarregar a página.
function mudou(campos) {
  perfil = { ...perfil, ...campos };
  window.dispatchEvent(new CustomEvent('perfil-mudou', { detail: campos }));
}

async function ocupado(form, fn) {
  const botao = form.querySelector('button[type=submit]');
  botao.disabled = true;
  try {
    await fn();
  } finally {
    botao.disabled = false;
  }
}

// ------------------------------------------------------------ foto

// Recorte quadrado do centro, LADO_FOTO × LADO_FOTO, JPEG. Respeita a rotação do celular.
async function recortarQuadrado(arquivo) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não foi possível abrir esta imagem.');
  }
  const lado = Math.min(bitmap.width, bitmap.height);
  const saida = Math.min(LADO_FOTO, lado);
  const canvas = Object.assign(document.createElement('canvas'), { width: saida, height: saida });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, saida, saida);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, saida, saida);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Não foi possível preparar esta imagem.');
  return blob;
}

async function chamarFoto(metodo, corpo) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch('/api/perfil/foto', {
    method: metodo,
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, ...(corpo && { 'Content-Type': corpo.type }) },
    body: corpo,
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Não foi possível salvar a foto.');
  return dados;
}

async function trocarFoto(e) {
  const arquivo = e.target.files?.[0];
  e.target.value = '';
  if (!arquivo) return;
  if (!arquivo.type.startsWith('image/')) return avisar('Escolha uma imagem (JPG, PNG…).', 'erro');
  $('avatar').classList.add('enviando');
  try {
    const { foto_url } = await chamarFoto('PUT', await recortarQuadrado(arquivo));
    mudou({ foto_url });
    desenharFoto();
    avisar('Foto atualizada.');
  } catch (err) {
    console.error(err);
    avisar(err.message, 'erro');
  } finally {
    $('avatar').classList.remove('enviando');
  }
}

async function removerFoto() {
  try {
    await chamarFoto('DELETE');
    mudou({ foto_url: null });
    desenharFoto();
    avisar('Foto removida.');
  } catch (err) {
    console.error(err);
    avisar(err.message, 'erro');
  }
}

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
    mudou({ nome });
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

// ------------------------------------------------------------ senha

// Pede a senha atual antes de trocar: um computador esquecido logado não basta para mudar a senha.
async function trocarSenha(e) {
  e.preventDefault();
  const form = e.target;
  const { atual, nova, confirma } = Object.fromEntries(new FormData(form));
  if (!atual) return avisar('Digite a senha atual.', 'erro');
  if (nova.length < 8) return avisar('A nova senha precisa ter pelo menos 8 caracteres.', 'erro');
  if (nova !== confirma) return avisar('As duas senhas novas não são iguais.', 'erro');
  if (nova === atual) return avisar('A nova senha é igual à atual.', 'erro');
  await ocupado(form, async () => {
    const conferir = await supabase.auth.signInWithPassword({ email: perfil.email, password: atual });
    if (conferir.error) return avisar('A senha atual não confere.', 'erro');
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) {
      console.error(error);
      const msg = error.code === 'weak_password' ? 'Senha fraca. Tente uma mais longa ou com mais variedade.'
        : error.code === 'same_password' ? 'A nova senha é igual à atual.'
          : 'Não foi possível trocar a senha agora. Tente de novo em instantes.';
      return avisar(msg, 'erro');
    }
    form.reset();
    avisar('Senha trocada.');
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
