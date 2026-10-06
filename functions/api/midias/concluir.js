// POST /api/midias/concluir  { chave, uploadId, partes: [{ partNumber, etag }] }
// Junta as partes no R2 e registra a mídia no conteúdo (versão atual, última posição).
import { responder, exigirAdmin, rest } from '../../_lib/servidor.js';
import { TIPOS, conteudoDaChave, urlDaChave } from '../../_lib/midias.js';

export async function onRequestPost({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const corpo = await request.json().catch(() => null);
  const { chave, uploadId, partes } = corpo ?? {};
  const conteudoId = conteudoDaChave(chave);
  const partesOk = Array.isArray(partes) && partes.length > 0 && partes.length <= 10000 &&
    partes.every((p) => Number.isInteger(p?.partNumber) && typeof p?.etag === 'string');
  if (!conteudoId || !uploadId || !partesOk) return responder(400, 'Upload inválido.');

  let objeto;
  try {
    objeto = await env.MIDIAS.resumeMultipartUpload(chave, uploadId)
      .complete(partes.map(({ partNumber, etag }) => ({ partNumber, etag })));
  } catch (err) {
    console.error('complete', err);
    return responder(502, 'Não foi possível finalizar o envio do arquivo.');
  }

  const [conteudo] = (await rest(env, `conteudos?select=id,versao_atual&id=eq.${conteudoId}`)) ?? [];
  if (!conteudo) {
    await env.MIDIAS.delete(chave);
    return responder(404, 'O conteúdo foi excluído durante o envio.');
  }

  const ultimas = await rest(env,
    `midias?select=ordem&conteudo_id=eq.${conteudoId}&versao=eq.${conteudo.versao_atual}&order=ordem.desc&limit=1`);
  const regra = TIPOS[objeto.httpMetadata?.contentType];

  const [midia] = await rest(env, 'midias', {
    metodo: 'POST',
    corpo: {
      conteudo_id: conteudoId,
      versao: conteudo.versao_atual,
      tipo: regra?.tipo ?? 'imagem',
      arquivo_url: urlDaChave(chave),
      tamanho_mb: Math.round((objeto.size / 1024 / 1024) * 100) / 100,
      ordem: (ultimas?.[0]?.ordem ?? -1) + 1,
    },
  });

  return responder(200, null, { midia });
}
