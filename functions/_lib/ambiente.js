// Produção é só o endereço oficial. O Preview (dev.beacreativeco-clientes.pages.dev) e o
// localhost usam o mesmo Supabase e o mesmo R2, mas nunca registram webhooks do Trello
// nem mandam e-mail para cliente de verdade (regras no CLAUDE.md, seção "Branches").
export const HOST_PRODUCAO = 'clientes.beacreativeco.com.br';

export function ehProducao(request) {
  return new URL(request.url).hostname === HOST_PRODUCAO;
}
