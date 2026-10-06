// POST /api/convidar  { cliente_id }
// Envia o convite do Supabase Auth para o e-mail do cliente e liga a
// conta criada ao cadastro (clientes.user_id). Só a admin pode chamar.
// Usa a chave secreta, por isso roda aqui e nunca no navegador.
import { responder, exigirAdmin, rest, cabecalhosServidor, UUID } from '../_lib/servidor.js';

export async function onRequestPost({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const corpo = await request.json().catch(() => null);
  const clienteId = corpo?.cliente_id;
  if (!clienteId || !UUID.test(clienteId)) return responder(400, 'Cliente inválido.');

  const [cliente] = (await rest(env, `clientes?select=id,nome,email,user_id&id=eq.${clienteId}`)) ?? [];
  if (!cliente) return responder(404, 'Cliente não encontrado.');
  if (!cliente.email) return responder(400, 'Cadastre o e-mail de acesso antes de enviar o convite.');
  if (cliente.user_id) return responder(409, 'Este cliente já tem acesso.');

  // O link do e-mail leva para /definir-senha/.
  const destino = new URL('/definir-senha/', request.url).toString();
  const respConvite = await fetch(`${env.SUPABASE_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(destino)}`, {
    method: 'POST',
    headers: { ...cabecalhosServidor(env), 'Content-Type': 'application/json' },
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

  try {
    await rest(env, `clientes?id=eq.${cliente.id}`, {
      metodo: 'PATCH', corpo: { user_id: novoUsuario.id }, retornar: false,
    });
  } catch {
    return responder(500, 'O convite saiu, mas a conta não foi ligada ao cliente. Avise o suporte técnico.');
  }

  return responder(200, null, { ok: true });
}
