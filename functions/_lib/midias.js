// Regras de arquivos de mídia. O front (public/assets/js/otimizar.js) comprime antes de subir,
// então aqui só entra o resultado: JPEG e MP4 leves (CLAUDE.md, seção "Armazenamento").

export const TAMANHO_PARTE = 10 * 1024 * 1024; // 10 MiB (R2 exige ≥ 5 MiB, todas iguais menos a última)

export const TIPOS = {
  'image/jpeg': { tipo: 'imagem', ext: 'jpg' },
  'video/mp4': { tipo: 'video', ext: 'mp4' },
};

export const LIMITE_MB = { imagem: 8, video: 300 };

// Pastas (prefixos) no bucket, cada uma com a sua regra de exclusão no R2 (Lifecycle Rules):
//   trabalho/   rascunho, com o cliente, em ajuste: não apaga
//   aprovados/  movido para cá na aprovação: o R2 apaga DIAS_APROVADOS dias depois
//   vitrine/    na vitrine do site: nunca apaga
// Arquivos antigos, de antes das pastas, ficam sem prefixo (contam como trabalho).
export const PASTAS = ['trabalho', 'aprovados', 'vitrine'];
export const DIAS_APROVADOS = 30;

const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PREFIXO = `(?:(${PASTAS.join('|')})\\/)?`;

// [pasta/]<conteudo_id>/<uuid>.<ext>: impossível de adivinhar e sempre amarrada a um conteúdo.
export const CHAVE = new RegExp(`^${PREFIXO}(${ID})\\/${ID}\\.(jpg|png|webp|mp4|mov)$`);

// Arquivos da conversa (áudio, imagem de referência): [pasta/]<conteudo_id>/conversa/<uuid>.<ext>
export const CHAVE_CONVERSA = new RegExp(`^${PREFIXO}(${ID})\\/conversa\\/${ID}\\.(jpg|m4a|webm|mp4)$`);

/** Em que pasta os arquivos de um conteúdo devem estar, pela situação dele. */
export function pastaDoConteudo({ status, na_vitrine: naVitrine }) {
  if (status !== 'aprovado') return 'trabalho';
  return naVitrine ? 'vitrine' : 'aprovados';
}

/** Pasta atual de uma chave ('trabalho' para as antigas, sem prefixo). */
export function pastaDaChave(chave) {
  return (CHAVE.exec(chave) ?? CHAVE_CONVERSA.exec(chave))?.[1] ?? 'trabalho';
}

/** Quando um arquivo gravado agora nesta pasta some (null: não some). */
export function expiraEm(pasta, desde = new Date()) {
  if (pasta !== 'aprovados') return null;
  return new Date(desde.getTime() + DIAS_APROVADOS * 24 * 60 * 60 * 1000).toISOString();
}

/** A mesma chave em outra pasta. */
export function chaveNaPasta(chave, pasta) {
  const semPasta = chave.replace(new RegExp(`^(${PASTAS.join('|')})/`), '');
  return `${pasta}/${semPasta}`;
}

// O que a conversa aceita (já otimizado no navegador) e o limite de cada um.
export const TIPOS_CONVERSA = {
  'image/jpeg': { tipo: 'imagem', ext: 'jpg', limiteMb: 8 },
  'audio/mp4': { tipo: 'audio', ext: 'm4a', limiteMb: 5 },
  'audio/webm': { tipo: 'audio', ext: 'webm', limiteMb: 5 },
};

export function conteudoDaChave(chave) {
  return CHAVE.exec(chave || '')?.[2] ?? null;
}

export function urlDaChave(chave) {
  return `/api/midia/${chave}`;
}

export function chaveDaUrl(url) {
  return (url || '').replace(/^\/api\/midia\//, '');
}
