// Deixa os arquivos de um conteúdo na pasta da situação dele (trabalho/, aprovados/, vitrine/).
// O R2 não renomeia: copia para a chave nova, atualiza o banco e só então apaga a antiga, para
// nunca ficar um link quebrado no meio. A cópia é um objeto novo, então a regra de exclusão
// do R2 começa a contar a partir da mudança (ex.: 30 dias depois da aprovação).
// Pode rodar de novo à vontade: o que já está na pasta certa não é tocado.
import { rest } from './servidor.js';
import { CHAVE, CHAVE_CONVERSA, chaveDaUrl, urlDaChave, pastaDaChave, chaveNaPasta, pastaDoConteudo, expiraEm } from './midias.js';

export async function organizarArquivos(env, conteudoId) {
  const [conteudo] = (await rest(env, `conteudos?select=id,status,na_vitrine&id=eq.${conteudoId}`)) ?? [];
  if (!conteudo) return { movidos: 0 };
  const pasta = pastaDoConteudo(conteudo);
  const expira = expiraEm(pasta);

  const [midias, mensagens] = await Promise.all([
    rest(env, `midias?select=id,arquivo_url,otimizado_url&conteudo_id=eq.${conteudoId}`),
    rest(env, `mensagens?select=id,arquivo_url,arquivo_mb&conteudo_id=eq.${conteudoId}&arquivo_url=not.is.null`),
  ]);

  const antigas = [];
  let faltando = 0;
  // Copia para a pasta certa. Devolve { url, tamanho } da cópia, ou null se já estava lá.
  async function mover(url) {
    const chave = chaveDaUrl(url);
    const partes = url && (CHAVE.exec(chave) ?? CHAVE_CONVERSA.exec(chave));
    if (!partes) return null;
    // Arquivo guardado na pasta de outro conteúdo (ex.: o mesmo arquivo usado em dois): não mexe,
    // senão apagar a chave antiga quebraria o outro conteúdo.
    if (partes[2] !== conteudoId) return null;
    if (pastaDaChave(chave) === pasta) return null;
    const objeto = await env.MIDIAS.get(chave);
    if (!objeto) {
      faltando++;
      return null;
    }
    const nova = chaveNaPasta(chave, pasta);
    await env.MIDIAS.put(nova, objeto.body, {
      httpMetadata: objeto.httpMetadata, customMetadata: objeto.customMetadata,
    });
    antigas.push(chave);
    return { url: urlDaChave(nova), tamanho: objeto.size };
  }

  let movidos = 0;
  for (const m of midias ?? []) {
    const [arquivo, otimizado] = [await mover(m.arquivo_url), await mover(m.otimizado_url)];
    if (!arquivo && !otimizado) continue;
    await rest(env, `midias?id=eq.${m.id}`, {
      metodo: 'PATCH', retornar: false,
      corpo: {
        ...(arquivo && { arquivo_url: arquivo.url }),
        ...(otimizado && { otimizado_url: otimizado.url }),
        expira_em: expira,
      },
    });
    movidos++;
  }

  for (const m of mensagens ?? []) {
    const arquivo = await mover(m.arquivo_url);
    // Pedido de ajuste com arquivo não traz o tamanho (vem pela função do banco): completa aqui.
    let tamanho = arquivo?.tamanho;
    if (!arquivo && m.arquivo_mb == null) tamanho = (await env.MIDIAS.head(chaveDaUrl(m.arquivo_url)))?.size;
    if (!arquivo && tamanho == null) continue;
    await rest(env, `mensagens?id=eq.${m.id}`, {
      metodo: 'PATCH', retornar: false,
      corpo: {
        ...(arquivo && { arquivo_url: arquivo.url, arquivo_expira_em: expira }),
        ...(m.arquivo_mb == null && tamanho != null && { arquivo_mb: Math.round((tamanho / 1024 / 1024) * 100) / 100 }),
      },
    });
    if (arquivo) movidos++;
  }

  if (antigas.length) await env.MIDIAS.delete(antigas);
  return { pasta, movidos, faltando };
}
