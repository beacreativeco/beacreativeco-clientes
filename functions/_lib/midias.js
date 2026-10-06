// Regras de arquivos de mídia (as mesmas do front, em public/assets/js/conteudos.js).

export const TAMANHO_PARTE = 10 * 1024 * 1024; // 10 MiB (R2 exige ≥ 5 MiB, todas iguais menos a última)

export const TIPOS = {
  'image/jpeg': { tipo: 'imagem', ext: 'jpg' },
  'image/png': { tipo: 'imagem', ext: 'png' },
  'image/webp': { tipo: 'imagem', ext: 'webp' },
  'video/mp4': { tipo: 'video', ext: 'mp4' },
  'video/quicktime': { tipo: 'video', ext: 'mov' },
};

export const LIMITE_MB = { imagem: 30, video: 2048 };

// <conteudo_id>/<uuid>.<ext>: impossível de adivinhar e sempre amarrada a um conteúdo.
export const CHAVE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|mov)$/;

export function conteudoDaChave(chave) {
  return CHAVE.exec(chave || '')?.[1] ?? null;
}

export function urlDaChave(chave) {
  return `/api/midia/${chave}`;
}

export function chaveDaUrl(url) {
  return (url || '').replace(/^\/api\/midia\//, '');
}
