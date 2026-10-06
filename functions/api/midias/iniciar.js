// POST /api/midias/iniciar  { conteudo_id, nome, tipo, tamanho }
// Abre um upload em partes no R2 e devolve { chave, uploadId, tamanhoParte }.
import { responder, exigirAdmin, rest, UUID } from '../../_lib/servidor.js';
import { TIPOS, LIMITE_MB, TAMANHO_PARTE } from '../../_lib/midias.js';

export async function onRequestPost({ request, env }) {
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;

  const corpo = await request.json().catch(() => null);
  const { conteudo_id: conteudoId, nome, tipo, tamanho } = corpo ?? {};
  if (!conteudoId || !UUID.test(conteudoId)) return responder(400, 'Conteúdo inválido.');

  const regra = TIPOS[tipo];
  if (!regra) return responder(400, 'Só entram arquivos já otimizados (JPG ou MP4).');
  if (!Number.isFinite(tamanho) || tamanho <= 0) return responder(400, 'Arquivo vazio.');
  if (tamanho > LIMITE_MB[regra.tipo] * 1024 * 1024) {
    return responder(413, `Mesmo comprimido, o arquivo passou de ${LIMITE_MB[regra.tipo]} MB.`
      + (regra.tipo === 'video' ? ' Encurte o vídeo ou deixe só no Drive.' : ''));
  }

  const [conteudo] = (await rest(env, `conteudos?select=id&id=eq.${conteudoId}`)) ?? [];
  if (!conteudo) return responder(404, 'Conteúdo não encontrado.');

  const chave = `${conteudoId}/${crypto.randomUUID()}.${regra.ext}`;
  const upload = await env.MIDIAS.createMultipartUpload(chave, {
    httpMetadata: { contentType: tipo },
    customMetadata: { nome: String(nome || `arquivo.${regra.ext}`).slice(0, 200) },
  });

  return responder(200, null, { chave, uploadId: upload.uploadId, tamanhoParte: TAMANHO_PARTE });
}
