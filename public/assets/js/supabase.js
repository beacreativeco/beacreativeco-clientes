import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Chama uma função do servidor (/api/...) com o login de quem está usando.
 * Devolve o JSON; em erro, lança Error com a mensagem do servidor.
 */
export async function chamarServidor(caminho, { metodo = 'GET', corpo } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(caminho, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      ...(corpo !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Não foi possível falar com o servidor.');
  return dados;
}
