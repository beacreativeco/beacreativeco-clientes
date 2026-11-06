// POST /api/convidar  { cliente_id }
// Envia o convite do Supabase Auth para o e-mail do cliente e liga a
// conta criada ao cadastro (clientes.user_id). Só a admin pode chamar.
// Usa a chave secreta, por isso roda aqui e nunca no navegador.
// Fora do banco da produção, não manda e-mail: gera o link do convite e devolve para a Bea copiar.
//
// Reenvio: com a conta já ligada, mas sem a pessoa nunca ter entrado (o link do convite vence
// em 24 h), manda de novo. Se ela chegou a confirmar o e-mail (abriu o link e não definiu a
// senha), o Supabase recusa outro convite; aí vai o link de definir senha (recuperação).
import { responder, exigirAdmin, rest, cabecalhosServidor, UUID } from '../_lib/servidor.js';
import { bancoDeProducao } from '../_lib/ambiente.js';
import { usuarioDoAuth, convitePendente } from '../_lib/acesso.js';

export async function onRequestPost({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const corpo = await request.json().catch(() => null);
  const clienteId = corpo?.cliente_id;
  if (!clienteId || !UUID.test(clienteId)) return responder(400, 'Cliente inválido.');

  const [cliente] = (await rest(env, `clientes?select=id,nome,email,user_id&id=eq.${clienteId}`)) ?? [];
  if (!cliente) return responder(404, 'Cliente não encontrado.');
  if (!cliente.email) return responder(400, 'Cadastre o e-mail de acesso antes de enviar o convite.');

  // Conta já ligada: só reenvia se a pessoa nunca entrou.
  let tipo = 'invite';
  if (cliente.user_id) {
    let usuario;
    try {
      usuario = await usuarioDoAuth(env, cliente.user_id);
    } catch {
      return responder(502, 'Não foi possível conferir o acesso do cliente. Tente de novo.');
    }
    if (usuario && !convitePendente(usuario)) return responder(409, 'Este cliente já tem acesso.');
    if (usuario?.email_confirmed_at) tipo = 'recovery';
  }

  // O link do e-mail leva para /definir-senha/ (serve para convite e recuperação).
  const destino = new URL('/definir-senha/', request.url).toString();
  const soLink = !bancoDeProducao(env);
  const dados = { email: cliente.email, data: { cliente_id: cliente.id } };
  const endereco = soLink
    ? `${env.SUPABASE_URL}/auth/v1/admin/generate_link`
    : `${env.SUPABASE_URL}/auth/v1/${tipo === 'invite' ? 'invite' : 'recover'}?redirect_to=${encodeURIComponent(destino)}`;
  const respConvite = await fetch(endereco, {
    method: 'POST',
    headers: { ...cabecalhosServidor(env), 'Content-Type': 'application/json' },
    body: JSON.stringify(soLink
      ? { ...(tipo === 'invite' ? dados : { email: cliente.email }), type: tipo, redirect_to: destino }
      : (tipo === 'invite' ? dados : { email: cliente.email })),
  });

  if (!respConvite.ok) {
    const erro = await respConvite.json().catch(() => ({}));
    console.error('convite falhou', tipo, respConvite.status, erro);
    if (respConvite.status === 429) {
      return responder(429, 'Limite de e-mails atingido. Tente de novo daqui a pouco.');
    }
    if (respConvite.status === 422 || erro.error_code === 'email_exists') {
      return responder(409, 'Já existe uma conta com esse e-mail. Use outro e-mail ou fale com o suporte técnico.');
    }
    return responder(502, 'O Supabase não conseguiu enviar o convite. Tente de novo.');
  }

  const resultado = await respConvite.json().catch(() => ({}));
  const novoId = resultado.user?.id ?? resultado.id;

  // Convite novo (ou a conta antiga sumiu do Auth): liga a conta ao cadastro.
  if (novoId && novoId !== cliente.user_id) {
    try {
      await rest(env, `clientes?id=eq.${cliente.id}`, {
        metodo: 'PATCH', corpo: { user_id: novoId }, retornar: false,
      });
    } catch {
      return responder(500, 'O convite saiu, mas a conta não foi ligada ao cliente. Avise o suporte técnico.');
    }
  }

  return responder(200, null, {
    ok: true,
    reenvio: Boolean(cliente.user_id),
    ...(soLink && { link: resultado.properties?.action_link ?? resultado.action_link }),
  });
}
