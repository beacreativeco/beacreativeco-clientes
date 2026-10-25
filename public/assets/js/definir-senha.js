import { supabase } from '/assets/js/supabase.js';
import { definirSenha, carregarPerfil, decidirDestino } from '/assets/js/auth.js';

const form = document.getElementById('form-senha');
const aviso = document.getElementById('aviso');
const botao = form.querySelector('button[type=submit]');

function mostrar(texto, tipo = 'erro') {
  aviso.textContent = texto;
  aviso.className = 'aviso ' + tipo;
  aviso.hidden = false;
}

// O link do convite/recuperação traz o token na URL; o supabase-js
// troca por uma sessão automaticamente ao iniciar.
const erroNaUrl = new URLSearchParams(window.location.hash.slice(1)).get('error_description');
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  mostrar(erroNaUrl
    ? 'Este link expirou ou já foi usado. Peça um novo na tela de login.'
    : 'Abra esta página pelo link que chegou no seu e-mail.');
} else {
  form.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  aviso.hidden = true;
  const senha = form.senha.value;
  if (senha.length < 8) return mostrar('A senha precisa ter pelo menos 8 caracteres.');
  if (senha !== form.confirmacao.value) return mostrar('As senhas não são iguais.');

  botao.disabled = true;
  try {
    const user = await definirSenha(senha);
    const destino = decidirDestino(await carregarPerfil(user.id));
    if (destino.erro) {
      await supabase.auth.signOut();
      throw new Error(destino.erro);
    }
    window.location.replace(destino.rota);
  } catch (err) {
    mostrar(err.message);
    botao.disabled = false;
  }
});
