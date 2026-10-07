// Utilitários das Pages Functions: respostas JSON, acesso ao Supabase com a
// chave secreta e verificação de que quem chama é a admin.
// Pasta com "_" e sem onRequest: não vira rota.

export function responder(status, erro, dados = {}) {
  return new Response(JSON.stringify(erro ? { erro } : dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Chaves novas (sb_secret_...) vão só no apikey; as antigas (JWT) também no Authorization.
export function cabecalhosServidor(env) {
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: chave };
  if (chave.startsWith('eyJ')) h.Authorization = `Bearer ${chave}`;
  return h;
}

// GET/POST/PATCH/DELETE no PostgREST com a chave secreta. Devolve o JSON ou null.
// `prefer` soma ao Prefer (ex.: 'resolution=merge-duplicates' para inserir ou atualizar).
export async function rest(env, caminho, { metodo = 'GET', corpo, retornar = true, prefer } = {}) {
  const headers = { ...cabecalhosServidor(env) };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (metodo !== 'GET') headers.Prefer = [retornar ? 'return=representation' : 'return=minimal', prefer].filter(Boolean).join(',');

  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${caminho}`, {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!resp.ok) {
    console.error('supabase', metodo, caminho, resp.status, await resp.text());
    throw new Error('Falha ao falar com o banco.');
  }
  return retornar && resp.status !== 204 ? resp.json() : null;
}

/**
 * Quem está logado, pelo token da sessão. Devolve { usuario } ou { resposta } (erro pronto).
 * Separa chave do servidor recusada (configuração, 500) de sessão vencida (401): antes as
 * duas viravam "Sua sessão expirou" e sair e entrar de novo não resolvia nada.
 */
export async function usuarioDaSessao(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { resposta: responder(500, 'Servidor sem configuração do Supabase.') };
  }

  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { resposta: responder(401, 'Sua sessão expirou. Entre de novo.') };

  const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (resp.ok) return { usuario: await resp.json() };

  // Chave recusada: o Supabase responde "Invalid API key" / "Unregistered API key".
  // Token ruim ou vencido vem como bad_jwt, sem falar em API key.
  const corpo = await resp.text();
  if (/api key/i.test(corpo)) {
    console.error('SUPABASE_SERVICE_ROLE_KEY recusada', resp.status, corpo);
    return { resposta: responder(500, 'Chave do servidor inválida (configuração). Avise o suporte.') };
  }
  return { resposta: responder(401, 'Sua sessão expirou. Entre de novo.') };
}

/**
 * Confere o token da sessão e se o usuário está em `admins`.
 * Devolve { usuario } ou { resposta } (um erro pronto para retornar).
 */
export async function exigirAdmin(request, env) {
  const { usuario, resposta } = await usuarioDaSessao(request, env);
  if (resposta) return { resposta };

  const admins = await rest(env, `admins?select=user_id&user_id=eq.${usuario.id}`);
  if (!admins?.length) return { resposta: responder(403, 'Só a admin pode fazer isso.') };

  return { usuario };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Quem pode escrever na conversa de um conteúdo: a admin, ou o cliente dono dele
 * (login ativo) quando o conteúdo não está em rascunho. As mesmas regras do RLS.
 * Devolve { autor: 'bea' | 'cliente' } ou { resposta } (um erro pronto para retornar).
 */
export async function exigirAcessoConversa(request, env, conteudoId) {
  const { usuario, resposta } = await usuarioDaSessao(request, env);
  if (resposta) return { resposta };

  const [conteudo] = (await rest(env, `conteudos?select=id,cliente_id,status&id=eq.${conteudoId}`)) ?? [];
  if (!conteudo) return { resposta: responder(404, 'Conteúdo não encontrado.') };

  const admins = await rest(env, `admins?select=user_id&user_id=eq.${usuario.id}`);
  if (admins?.length) return { autor: 'bea' };

  const [cliente] = (await rest(env,
    `clientes?select=id&user_id=eq.${usuario.id}&login_ativo=is.true&id=eq.${conteudo.cliente_id}`)) ?? [];
  if (!cliente || conteudo.status === 'rascunho') {
    return { resposta: responder(403, 'Você não tem acesso a esta conversa.') };
  }
  return { autor: 'cliente' };
}
