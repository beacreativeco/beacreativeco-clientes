import { supabase } from '/assets/js/supabase.js';
import { entrar, entrarComGoogle, erroDoGoogle, pedirNovaSenha, carregarPerfil, decidirDestino } from '/assets/js/auth.js';

const form = document.getElementById('form-login');
const aviso = document.getElementById('aviso');
const botao = form.querySelector('button[type=submit]');

function mostrar(texto, tipo = 'erro') {
  aviso.textContent = texto;
  aviso.className = 'aviso ' + tipo;
  aviso.hidden = false;
}

// Volta do Google com erro (ex.: conta sem acesso): explica e limpa a URL.
const erroGoogle = erroDoGoogle();
if (erroGoogle) {
  mostrar(erroGoogle);
  history.replaceState(null, '', location.pathname);
}

// Já logado (inclusive voltando do Google)? Vai direto pra área certa.
// Acesso suspenso: sai e explica. Se falhar, só fica na tela de login normalmente.
try {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const destino = decidirDestino(await carregarPerfil(session.user.id));
    if (destino.rota) window.location.replace(destino.rota);
    else {
      await supabase.auth.signOut();
      mostrar(destino.erro);
    }
  }
} catch (err) {
  console.error(err);
}

document.getElementById('google').addEventListener('click', async (e) => {
  aviso.hidden = true;
  e.currentTarget.disabled = true;
  try {
    await entrarComGoogle(); // sai da página para o Google
  } catch (err) {
    mostrar(err.message);
    e.currentTarget.disabled = false;
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  aviso.hidden = true;
  const email = form.email.value.trim();
  const senha = form.senha.value;
  if (!email || !senha) return mostrar('Preencha e-mail e senha.');

  botao.disabled = true;
  try {
    window.location.replace(await entrar(email, senha));
  } catch (err) {
    mostrar(err.message);
    botao.disabled = false;
  }
});

document.getElementById('esqueci').addEventListener('click', async () => {
  const email = form.email.value.trim();
  if (!email) return mostrar('Digite seu e-mail acima e clique de novo.');
  try {
    await pedirNovaSenha(email);
    mostrar('Se esse e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.', 'ok');
  } catch (err) {
    mostrar(err.message);
  }
});
