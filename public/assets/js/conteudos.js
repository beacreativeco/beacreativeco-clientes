// Vocabulário compartilhado dos conteúdos (rótulos, formatos, datas).

export const FORMATOS = {
  post: 'Post',
  carrossel: 'Carrossel',
  story: 'Story',
  reels: 'Reels',
};

// Como a Bea lê cada situação no painel.
export const SITUACOES = {
  rascunho: { texto: 'Rascunho', classe: 'rascunho' },
  em_aprovacao: { texto: 'Aguardando cliente', classe: 'aguardando' },
  ajuste_solicitado: { texto: 'Pediu ajuste', classe: 'ajuste' },
  aprovado: { texto: '✦ Aprovado', classe: 'aprovado' },
};

export const LIMITE_LEGENDA = 2200; // limite do Instagram

// "2026-10-14" vira Date local (sem o fuso empurrar para o dia anterior).
export function lerData(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function diaEMes(iso) {
  const data = lerData(iso);
  if (!data) return null;
  return {
    dia: String(data.getDate()),
    mes: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    semana: data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
  };
}

export function dataHora(isoTimestamp) {
  if (!isoTimestamp) return '';
  return new Date(isoTimestamp).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function parametro(nome) {
  return new URLSearchParams(window.location.search).get(nome);
}

// ---------------------------------------------------------------- mídias
// Mesmas regras de functions/_lib/midias.js (o servidor confere de novo).

export const TIPOS_ARQUIVO = {
  'image/jpeg': 'imagem',
  'image/png': 'imagem',
  'image/webp': 'imagem',
  'video/mp4': 'video',
  'video/quicktime': 'video',
};

export const LIMITE_MB = { imagem: 30, video: 2048 };

// O que cada formato aceita e quantos arquivos precisa para ir ao cliente.
export const REGRAS_FORMATO = {
  post: { aceita: ['imagem'], min: 1, max: 1, dica: '1 imagem' },
  carrossel: { aceita: ['imagem', 'video'], min: 2, max: 20, dica: 'De 2 a 20 imagens ou vídeos' },
  story: { aceita: ['imagem', 'video'], min: 1, max: 20, dica: 'Imagens ou vídeos, na ordem em que vão aparecer' },
  reels: { aceita: ['video'], min: 1, max: 1, dica: '1 vídeo' },
};

export function aceiteDoInput(formato) {
  const aceita = REGRAS_FORMATO[formato].aceita;
  return Object.entries(TIPOS_ARQUIVO).filter(([, tipo]) => aceita.includes(tipo)).map(([mime]) => mime).join(',');
}

// Alguns navegadores (Windows, .mov) deixam file.type vazio: cai para a extensão.
const POR_EXTENSAO = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime' };
export function tipoMime(arquivo) {
  if (TIPOS_ARQUIVO[arquivo.type]) return arquivo.type;
  return POR_EXTENSAO[arquivo.name.split('.').pop().toLowerCase()] ?? arquivo.type;
}

// Por que este arquivo não pode entrar? (null = pode)
export function problemaDoArquivo(arquivo, formato) {
  const tipo = TIPOS_ARQUIVO[tipoMime(arquivo)];
  if (!tipo) {
    return /heic|heif/i.test(arquivo.type || arquivo.name)
      ? `${arquivo.name}: fotos HEIC do iPhone não abrem no navegador. Exporte como JPG.`
      : `${arquivo.name}: formato não aceito. Use JPG, PNG, WEBP, MP4 ou MOV.`;
  }
  const regra = REGRAS_FORMATO[formato];
  if (!regra.aceita.includes(tipo)) {
    return `${arquivo.name}: ${FORMATOS[formato].toLowerCase()} aceita só ${regra.aceita.length === 1 ? (regra.aceita[0] === 'video' ? 'vídeo' : 'imagem') : 'imagem ou vídeo'}.`;
  }
  if (arquivo.size > LIMITE_MB[tipo] * 1024 * 1024) {
    return `${arquivo.name}: passa do limite de ${LIMITE_MB[tipo].toLocaleString('pt-BR')} MB.`;
  }
  return null;
}

// As mídias atuais servem para enviar ao cliente? (null = servem)
export function problemaDasMidias(formato, midias) {
  const regra = REGRAS_FORMATO[formato];
  const fora = midias.filter((m) => !regra.aceita.includes(m.tipo));
  if (fora.length) return `Este formato não aceita ${fora[0].tipo === 'video' ? 'vídeo' : 'imagem'}. Remova o arquivo ou troque o formato.`;
  if (midias.length < regra.min) {
    return midias.length === 0
      ? 'Adicione os arquivos antes de enviar para aprovação.'
      : `${FORMATOS[formato]} precisa de pelo menos ${regra.min} arquivos.`;
  }
  if (midias.length > regra.max) return `${FORMATOS[formato]} aceita no máximo ${regra.max} ${regra.max === 1 ? 'arquivo' : 'arquivos'}.`;
  return null;
}

export function tamanhoLegivel(mb) {
  if (mb == null) return '';
  return mb >= 1024 ? `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
    : `${mb.toLocaleString('pt-BR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}
