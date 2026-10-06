// PUT /api/conversa/arquivo?conteudo_id=<uuid>   (corpo = o arquivo, já otimizado no navegador)
// Guarda uma imagem de referência ou um áudio da conversa em <conteudo_id>/conversa/<uuid>.<ext>
// e devolve { arquivo_url }. A mensagem é criada depois pelo navegador, e o RLS confere
// que o arquivo é da pasta deste conteúdo.
import { responder, exigirAcessoConversa, UUID } from '../../_lib/servidor.js';
import { TIPOS_CONVERSA, urlDaChave } from '../../_lib/midias.js';

export async function onRequestPut({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const conteudoId = new URL(request.url).searchParams.get('conteudo_id');
  if (!conteudoId || !UUID.test(conteudoId)) return responder(400, 'Conteúdo inválido.');

  const { resposta } = await exigirAcessoConversa(request, env, conteudoId);
  if (resposta) return resposta;

  const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  const regra = TIPOS_CONVERSA[tipo];
  if (!regra) return responder(400, 'Só entram imagens JPG e áudios M4A ou WEBM.');

  const tamanho = Number(request.headers.get('Content-Length'));
  if (tamanho > regra.limiteMb * 1024 * 1024) return responder(413, `O arquivo passou de ${regra.limiteMb} MB.`);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return responder(400, 'Arquivo vazio.');
  if (bytes.byteLength > regra.limiteMb * 1024 * 1024) return responder(413, `O arquivo passou de ${regra.limiteMb} MB.`);

  const chave = `${conteudoId}/conversa/${crypto.randomUUID()}.${regra.ext}`;
  await env.MIDIAS.put(chave, bytes, { httpMetadata: { contentType: tipo } });
  return responder(200, null, { arquivo_url: urlDaChave(chave) });
}
