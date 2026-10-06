import { supabase } from './supabase.js';

export const ROTAS = {
  login: '/',
  admin: '/admin/',
  cliente: '/cliente/',
  definirSenha: '/definir-senha/',
};

/**
 * Descobre quem é o usuário logado consultando o banco (o RLS já filtra):
 * - admin: true se existe linha em `admins` para ele
 * - cliente: o cadastro dele em `clientes`, ou null
 *   (cliente suspenso também volta null, porque o RLS esconde a linha)
 */
export async function carregarPerfil(userId) {
  const [admin, cliente] = await Promise.all([
    supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('clientes').select('id, nome, slug, foto_perfil').eq('user_id', userId).maybeSingle(),
  ]);

  if (admin.error) throw admin.error;
  if (cliente.error) throw cliente.error;

  return { admin: Boolean(admin.data), cliente: cliente.data };
}

/**
 * Decide para onde o usuário vai depois do login.
 * Retorna { rota } para redirecionar, ou { erro } para deslogar e mostrar a mensagem.
 */
export function decidirDestino(perfil) {
  // Admin tem prioridade: se a Bea também tiver cadastro de cliente, entra no painel.
  if (perfil.admin) return { rota: ROTAS.admin };
  if (perfil.cliente) return { rota: ROTAS.cliente };
  // Sem cadastro ou suspenso (o RLS esconde os dois do mesmo jeito).
  return { erro: 'Seu acesso não está ativo no momento. Fale com a Bea para liberar.' };
}

/**
 * Faz login e devolve o destino. Lança erro com mensagem amigável.
 */
export async function entrar(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    throw new Error(
      error.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar agora. Tente de novo em instantes.'
    );
  }

  const destino = decidirDestino(await carregarPerfil(data.user.id));
  if (destino.erro) {
    await supabase.auth.signOut();
    throw new Error(destino.erro);
  }
  return destino.rota;
}

export async function sair() {
  await supabase.auth.signOut();
  window.location.replace(ROTAS.login);
}

/**
 * Usar no topo de páginas logadas. Se o usuário não puder estar aqui,
 * redireciona. Proteção de verdade é o RLS; isto é só para a navegação.
 * @param {'admin'|'cliente'} area
 */
export async function protegerPagina(area) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace(ROTAS.login);
    return null;
  }

  const perfil = await carregarPerfil(session.user.id);
  const destino = decidirDestino(perfil);

  if (destino.erro) {
    await supabase.auth.signOut();
    window.location.replace(ROTAS.login);
    return null;
  }
  if (destino.rota !== ROTAS[area]) {
    window.location.replace(destino.rota);
    return null;
  }
  return { session, perfil };
}

export async function pedirNovaSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + ROTAS.definirSenha,
  });
  if (error) throw new Error('Não foi possível enviar o e-mail. Tente de novo em instantes.');
}

export async function definirSenha(novaSenha) {
  const { data, error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) {
    throw new Error(
      error.code === 'weak_password'
        ? 'Senha fraca. Use pelo menos 8 caracteres.'
        : 'Não foi possível salvar a senha. O link pode ter expirado.'
    );
  }
  return data.user;
}
