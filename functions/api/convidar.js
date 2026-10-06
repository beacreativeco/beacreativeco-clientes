// POST /api/convidar  { cliente_id }
// Envia o convite do Supabase Auth para o e-mail do cliente e liga a
// conta criada ao cadastro (clientes.user_id). Só a admin pode chamar.
// Usa a chave secreta, por isso roda aqui e nunca no navegador.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestPost({ request, env }) {
  const base = env.SUPABASE_URL;
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !chave) return responder(500, 'Servidor sem configuração do Supabase.');

  const servidor = cabecalhosServidor(chave);

  // 1. Quem está chamando? (valida o token da sessão no Supabase)
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return responder(401, 'Sua sessão expirou. Entre de novo.');

  const respUsuario = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: chave, Authorization: `Bearer ${token}` },
  });
  if (!respUsuario.ok) return responder(401, 'Sua sessão expirou. Entre de novo.');
  const usuario = await respUsuario.json();

  // 2. É admin?
  const admins = await consultar(base, servidor, `admins?select=user_id&user_id=eq.${usuario.id}`);
  if (!admins?.length) return responder(403, 'Só a admin pode enviar convites.');

  // 3. Qual cliente?
  const corpo = await request.json().catch(() => null);
  const clienteId = corpo?.cliente_id;
  if (!clienteId || !UUID.test(clienteId)) return responder(400, 'Cliente inválido.');

  const [cliente] = (await consultar(base, servidor, `clientes?select=id,nome,email,user_id&id=eq.${clienteId}`)) ?? [];
  if (!cliente) return responder(404, 'Cliente não encontrado.');
  if (!cliente.email) return responder(400, 'Cadastre o e-mail de acesso antes de enviar o convite.');
  if (cliente.user_id) return responder(409, 'Este cliente já tem acesso.');

  // 4. Envia o convite. O link do e-mail leva para /definir-senha/.
  const destino = new URL('/definir-senha/', request.url).toString();
  const respConvite = await fetch(`${base}/auth/v1/invite?redirect_to=${encodeURIComponent(destino)}`, {
    method: 'POST',
    headers: { ...servidor, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cliente.email, data: { cliente_id: cliente.id } }),
  });

  if (!respConvite.ok) {
    const erro = await respConvite.json().catch(() => ({}));
    console.error('convite falhou', respConvite.status, erro);
    if (respConvite.status === 422 || erro.error_code === 'email_exists') {
      return responder(409, 'Já existe uma conta com esse e-mail. Use outro e-mail ou fale com o suporte técnico.');
    }
    if (respConvite.status === 429) {
      return responder(429, 'Limite de e-mails atingido. Tente de novo daqui a pouco.');
    }
    return responder(502, 'O Supabase não conseguiu enviar o convite. Tente de novo.');
  }

  const novoUsuario = await respConvite.json();

  // 5. Liga a conta ao cadastro do cliente.
  const respVinculo = await fetch(`${base}/rest/v1/clientes?id=eq.${cliente.id}`, {
    method: 'PATCH',
    headers: { ...servidor, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: novoUsuario.id }),
  });
  if (!respVinculo.ok) {
    console.error('vínculo falhou', respVinculo.status, await respVinculo.text());
    return responder(500, 'O convite saiu, mas a conta não foi ligada ao cliente. Avise o suporte técnico.');
  }

  return responder(200, null, { ok: true });
}

// Chaves novas (sb_secret_...) vão só no apikey; as antigas (JWT) também no Authorization.
function cabecalhosServidor(chave) {
  const h = { apikey: chave };
  if (chave.startsWith('eyJ')) h.Authorization = `Bearer ${chave}`;
  return h;
}

async function consultar(base, cabecalhos, caminho) {
  const resp = await fetch(`${base}/rest/v1/${caminho}`, { headers: cabecalhos });
  if (!resp.ok) {
    console.error('consulta falhou', caminho, resp.status, await resp.text());
    return null;
  }
  return resp.json();
}

function responder(status, erro, dados = {}) {
  return new Response(JSON.stringify(erro ? { erro } : dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
