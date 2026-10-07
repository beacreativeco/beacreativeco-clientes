// O que as duas páginas "Meu perfil" (Bea e cliente) têm igual: foto e troca de senha.
// Foto: recortada em quadrado e comprimida aqui, gravada pelo servidor (/api/perfil/foto),
// que sabe se é a Bea ou o cliente pelo login. Senha: Supabase Auth, pedindo a atual.
import { supabase } from './supabase.js';
import { pedirNovaSenha } from './auth.js';
import { avisar } from './ui.js';
import { desenharAvatar } from './perfil-menu.js';

const LADO_FOTO = 400;

/** Desliga o botão de enviar enquanto `fn` roda. */
export async function ocupado(form, fn) {
  const botao = form.querySelector('button[type=submit]');
  botao.disabled = true;
  try {
    await fn();
  } finally {
    botao.disabled = false;
  }
}

/** Avisa o menu do topo (avatar e nome) sem recarregar a página. */
export function avisarMudanca(campos) {
  window.dispatchEvent(new CustomEvent('perfil-mudou', { detail: campos }));
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

/**
 * Trocar e remover a foto.
 * @param {{ avatar: HTMLElement, input: HTMLInputElement, remover: HTMLButtonElement,
 *   perfil: () => object, aoMudar: (campos: object) => void }} opcoes
 * @returns {() => void} redesenha o avatar (ex.: depois de mudar o nome, por causa das iniciais)
 */
export function ligarFoto({ avatar, input, remover, perfil, aoMudar }) {
  const desenhar = () => {
    desenharAvatar(avatar, perfil());
    remover.hidden = !perfil().foto_url;
  };
  const mudou = (foto_url) => {
    aoMudar({ foto_url });
    avisarMudanca({ foto_url });
    desenhar();
  };

  input.addEventListener('change', async () => {
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) return avisar('Escolha uma imagem (JPG, PNG…).', 'erro');
    avatar.classList.add('enviando');
    try {
      const { foto_url } = await chamarFoto('PUT', await recortarQuadrado(arquivo));
      mudou(foto_url);
      avisar('Foto atualizada.');
    } catch (err) {
      console.error(err);
      avisar(err.message, 'erro');
    } finally {
      avatar.classList.remove('enviando');
    }
  });

  remover.addEventListener('click', async () => {
    try {
      await chamarFoto('DELETE');
      mudou(null);
      avisar('Foto removida.');
    } catch (err) {
      console.error(err);
      avisar(err.message, 'erro');
    }
  });

  desenhar();
  return desenhar;
}

// ------------------------------------------------------------ senha

/**
 * Troca de senha pedindo a atual: um computador esquecido logado não basta para mudar a senha.
 * "Esqueci a senha atual" manda o link de criar senha por e-mail; serve também a quem
 * só entrou com o Google ou pelo convite e nunca teve senha.
 * @param {HTMLFormElement} form  campos atual, nova e confirma
 * @param {HTMLButtonElement} esqueci
 * @param {() => string} email
 */
export function ligarSenha(form, esqueci, email) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { atual, nova, confirma } = Object.fromEntries(new FormData(form));
    if (!atual) return avisar('Digite a senha atual.', 'erro');
    if (nova.length < 8) return avisar('A nova senha precisa ter pelo menos 8 caracteres.', 'erro');
    if (nova !== confirma) return avisar('As duas senhas novas não são iguais.', 'erro');
    if (nova === atual) return avisar('A nova senha é igual à atual.', 'erro');
    await ocupado(form, async () => {
      const conferir = await supabase.auth.signInWithPassword({ email: email(), password: atual });
      if (conferir.error) return avisar('A senha atual não confere. Se não lembra ou nunca criou uma, use "Esqueci a senha atual".', 'erro');
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
  });

  esqueci.addEventListener('click', async () => {
    esqueci.disabled = true;
    try {
      await pedirNovaSenha(email());
      avisar(`Enviamos para ${email()} um link para criar a nova senha.`);
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      esqueci.disabled = false;
    }
  });
}
