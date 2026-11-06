// GET /api/clientes/acessos (só a admin)
//   → { pendentes: [cliente_id, ...] }: clientes convidados que nunca abriram o link
//     (a página Clientes mostra "Convite pendente" com "Reenviar convite").
import { responder, exigirAdmin, rest } from '../../_lib/servidor.js';
import { usuarioDoAuth, convitePendente } from '../../_lib/acesso.js';

export async function onRequestGet({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const clientes = (await rest(env,
    'clientes?select=id,user_id&user_id=not.is.null&arquivado_em=is.null')) ?? [];
  const situacoes = await Promise.all(clientes.map(async (c) => {
    try {
      const usuario = await usuarioDoAuth(env, c.user_id);
      return usuario && convitePendente(usuario) ? c.id : null;
    } catch {
      return null; // na dúvida, a tela continua como estava ("Acesso ativo")
    }
  }));
  return responder(200, null, { pendentes: situacoes.filter(Boolean) });
}
