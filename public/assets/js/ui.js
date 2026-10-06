import { protegerPagina } from './auth.js';

/**
 * Abre uma página logada: confere o acesso, roda `montar` e troca o
 * "Carregando…" pelo conteúdo. Se algo falhar, mostra o erro com
 * um botão para tentar de novo em vez de ficar carregando pra sempre.
 * @param {'admin'|'cliente'} area
 * @param {(acesso: {session, perfil}) => Promise<void>|void} montar
 */
export async function iniciarPagina(area, montar) {
  const carregando = document.getElementById('carregando');
  const app = document.getElementById('app');

  try {
    const acesso = await protegerPagina(area);
    if (!acesso) return; // já está redirecionando
    await montar(acesso);
    carregando.hidden = true;
    app.hidden = false;
  } catch (err) {
    console.error(err);
    mostrarFalhaAoCarregar(carregando);
  }
}

function mostrarFalhaAoCarregar(container) {
  container.replaceChildren();
  container.classList.add('falha');

  const texto = document.createElement('p');
  texto.textContent = 'Não foi possível carregar a página. Confira sua internet e tente de novo.';

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'botao botao-compacto';
  botao.textContent = 'Tentar de novo';
  botao.addEventListener('click', () => window.location.reload());

  container.append(texto, botao);
  container.hidden = false;
}

/**
 * Aviso rápido no rodapé da tela (salvo, convite enviado, erro...).
 * Precisa de um <div id="toast" class="toast" role="status" hidden> na página.
 */
let timerToast;
export function avisar(texto, tipo = 'ok') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = texto;
  toast.className = 'toast ' + tipo;
  toast.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { toast.hidden = true; }, tipo === 'erro' ? 7000 : 4000);
}
