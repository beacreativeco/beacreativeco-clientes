// Produção é só o endereço oficial. O Preview (dev.beacreativeco-clientes.pages.dev) e o
// localhost usam o Supabase e o R2 de desenvolvimento, e nunca registram webhooks do Trello
// nem mandam e-mail para cliente de verdade (regras no CLAUDE.md, seção "Branches").
export const HOST_PRODUCAO = 'clientes.beacreativeco.com.br';
export const HOST_PREVIEW = 'dev.beacreativeco-clientes.pages.dev';

// Banco da produção: com qualquer outro (o de desenvolvimento), o Trello fica preso aos quadros
// de teste e o convite vira um link para copiar (o e-mail padrão do Supabase só vai para a equipe).
export const SUPABASE_PRODUCAO = 'https://dudxbbqyofzetuvpuzrh.supabase.co';
export const bancoDeProducao = (env) => (env.SUPABASE_URL ?? '').replace(/\/+$/, '') === SUPABASE_PRODUCAO;

export function ehProducao(request) {
  return new URL(request.url).hostname === HOST_PRODUCAO;
}
