// GET /api/erros/config → { dsn, ambiente } para o Sentry (public/assets/js/erros.js).
// Sem login (a tela de entrada também manda erros). Só a produção e o Preview recebem o DSN;
// em qualquer outro endereço (localhost, links de commit do Pages) volta {} e nada é enviado.
// O DSN fica em SENTRY_DSN no Cloudflare (Production e Preview), fora do Git.
import { ehProducao, HOST_PREVIEW } from '../../_lib/ambiente.js';

export function onRequestGet({ request, env }) {
  const host = new URL(request.url).hostname;
  const ambiente = ehProducao(request) ? 'producao' : host === HOST_PREVIEW ? 'preview' : null;
  const corpo = ambiente && env.SENTRY_DSN ? { dsn: env.SENTRY_DSN.trim(), ambiente } : {};
  return new Response(JSON.stringify(corpo), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}
