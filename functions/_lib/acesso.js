// Situação do login de um cliente no Supabase Auth (com a chave secreta).
// O convite liga a conta ao cadastro (clientes.user_id) na hora em que sai, mas o cliente
// só "tem acesso" de verdade depois de abrir o link: até lá o convite fica pendente e pode
// ser reenviado (o link do Supabase vence em 24 h).
import { cabecalhosServidor } from './servidor.js';

/** Usuário do Auth pelo id, ou null se não existe mais. Lança erro se o Supabase falhar. */
export async function usuarioDoAuth(env, userId) {
  const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: cabecalhosServidor(env),
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    console.error('auth admin/users', resp.status, await resp.text());
    throw new Error('Falha ao consultar o login.');
  }
  return resp.json();
}

/** Convite pendente: a conta existe, mas a pessoa nunca entrou no sistema. */
export const convitePendente = (usuario) => !usuario?.last_sign_in_at;
