// Regras de arquivos de mídia. O front (public/assets/js/otimizar.js) comprime antes de subir,
// então aqui só entra o resultado: JPEG e MP4 leves (CLAUDE.md, seção "Armazenamento").

export const TAMANHO_PARTE = 10 * 1024 * 1024; // 10 MiB (R2 exige ≥ 5 MiB, todas iguais menos a última)

export const TIPOS = {
  'image/jpeg': { tipo: 'imagem', ext: 'jpg' },
  'video/mp4': { tipo: 'video', ext: 'mp4' },
};

export const LIMITE_MB = { imagem: 8, video: 300 };

// <conteudo_id>/<uuid>.<ext>: impossível de adivinhar e sempre amarrada a um conteúdo.
export const CHAVE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|mov)$/;

// Arquivos da conversa (áudio, imagem de referência): <conteudo_id>/conversa/<uuid>.<ext>
export const CHAVE_CONVERSA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/conversa\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|m4a|webm|mp4)$/;

export function conteudoDaChave(chave) {
  return CHAVE.exec(chave || '')?.[1] ?? null;
}

export function urlDaChave(chave) {
  return `/api/midia/${chave}`;
}

export function chaveDaUrl(url) {
  return (url || '').replace(/^\/api\/midia\//, '');
}
