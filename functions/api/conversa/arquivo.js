// PUT /api/conversa/arquivo?conteudo_id=<uuid>   (corpo = o arquivo, já otimizado no navegador)
// PUT /api/conversa/arquivo?cliente_id=<uuid>    (mensagem sem conteúdo, na conversa do cliente)
// Guarda uma imagem de referência ou um áudio da conversa e devolve { arquivo_url }:
//   com conteúdo: <pasta do conteúdo>/<conteudo_id>/conversa/<uuid>.<ext> (segue o conteúdo)
//   sem conteúdo: conversa/<cliente_id>/<uuid>.<ext> (o R2 apaga 30 dias depois)
// A mensagem é criada depois pelo navegador, e o RLS confere que o arquivo é da pasta certa.
import { responder, exigirAcessoConversa, exigirAcessoConversaDoCliente, rest, UUID } from '../../_lib/servidor.js';
import { TIPOS_CONVERSA, urlDaChave, pastaDoConteudo, expiraEm } from '../../_lib/midias.js';

export async function onRequestPut({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const parametros = new URL(request.url).searchParams;
  const conteudoId = parametros.get('conteudo_id');
  const clienteId = parametros.get('cliente_id');
  if (conteudoId ? !UUID.test(conteudoId) : !clienteId || !UUID.test(clienteId)) {
    return responder(400, 'Conversa inválida.');
  }

  const { resposta } = conteudoId
    ? await exigirAcessoConversa(request, env, conteudoId)
    : await exigirAcessoConversaDoCliente(request, env, clienteId);
  if (resposta) return resposta;

  const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  const regra = TIPOS_CONVERSA[tipo];
  if (!regra) return responder(400, 'Só entram imagens JPG e áudios M4A ou WEBM.');

  const tamanho = Number(request.headers.get('Content-Length'));
  if (tamanho > regra.limiteMb * 1024 * 1024) return responder(413, `O arquivo passou de ${regra.limiteMb} MB.`);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return responder(400, 'Arquivo vazio.');
  if (bytes.byteLength > regra.limiteMb * 1024 * 1024) return responder(413, `O arquivo passou de ${regra.limiteMb} MB.`);

  let chave;
  let pasta;
  if (conteudoId) {
    const [conteudo] = (await rest(env, `conteudos?select=status,na_vitrine&id=eq.${conteudoId}`)) ?? [];
    pasta = pastaDoConteudo(conteudo ?? {});
    chave = `${pasta}/${conteudoId}/conversa/${crypto.randomUUID()}.${regra.ext}`;
  } else {
    pasta = 'conversa';
    chave = `conversa/${clienteId}/${crypto.randomUUID()}.${regra.ext}`;
  }
  await env.MIDIAS.put(chave, bytes, { httpMetadata: { contentType: tipo } });
  return responder(200, null, {
    arquivo_url: urlDaChave(chave),
    arquivo_mb: Math.round((bytes.byteLength / 1024 / 1024) * 100) / 100,
    arquivo_expira_em: expiraEm(pasta),
  });
}
