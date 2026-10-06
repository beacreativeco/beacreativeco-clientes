// Deixa imagens e vídeos leves no navegador da Bea antes de subir (o original fica no Drive).
// Regras em CLAUDE.md, seção "Armazenamento".

const MEDIABUNNY = 'https://cdn.jsdelivr.net/npm/mediabunny@1.61.3/dist/bundles/mediabunny.min.mjs';

const IMAGEM = { largura: 1080, altura: 1920, qualidade: 0.85 };
const VIDEO = { ladoMenor: 1080, fps: 30, bitrate: 4_000_000 };

function trocarExtensao(nome, ext) {
  return `${nome.replace(/\.[^.]+$/, '') || 'arquivo'}.${ext}`;
}

function cancelado() {
  return new DOMException('Envio cancelado.', 'AbortError');
}

/**
 * Cabe em 1080 × 1920 (nunca aumenta) e vira JPEG 85%.
 * @param {File} arquivo
 * @returns {Promise<File>}
 */
export async function otimizarImagem(arquivo) {
  let bitmap;
  try {
    // 'from-image' respeita a rotação gravada pelo celular.
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não foi possível abrir esta imagem.');
  }
  const escala = Math.min(1, IMAGEM.largura / bitmap.width, IMAGEM.altura / bitmap.height);
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // PNG transparente: JPEG não tem transparência, fundo branco em vez de preto
  ctx.fillRect(0, 0, largura, altura);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGEM.qualidade));
  if (!blob) throw new Error('Não foi possível comprimir esta imagem.');
  return new File([blob], trocarExtensao(arquivo.name, 'jpg'), { type: 'image/jpeg' });
}

export function navegadorComprimeVideo() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
}

let mediabunny;
const carregarMediabunny = () => (mediabunny ??= import(MEDIABUNNY));

const MOTIVOS = {
  undecodable_source_codec: 'este navegador não consegue ler o formato (vídeo de iPhone em HEVC? Exporte como H.264 ou use o Chrome)',
  unknown_source_codec: 'o formato não foi reconhecido',
  no_encodable_target_codec: 'este navegador não consegue gerar o formato do Instagram. Use o Chrome ou o Edge atualizados',
};

/**
 * H.264 com o lado menor até 1080, até 30 fps, ~4 Mbps; áudio AAC.
 * @param {File} arquivo
 * @param {{ aoProgredir?: (fracao: number) => void, sinal?: AbortSignal }} opcoes
 * @returns {Promise<File>}
 */
export async function otimizarVideo(arquivo, { aoProgredir = () => {}, sinal } = {}) {
  if (!navegadorComprimeVideo()) {
    throw new Error('Este navegador não consegue comprimir vídeos. Use o Chrome ou o Edge atualizados.');
  }
  const {
    Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS, Quality,
  } = await carregarMediabunny();
  if (sinal?.aborted) throw cancelado();

  const input = new Input({ source: new BlobSource(arquivo), formats: ALL_FORMATS });
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }), // índice no começo: o player começa sem baixar tudo
    target: new BufferTarget(),
  });

  try {
    const conversao = await Conversion.init({
      input,
      output,
      video: async (trilha) => {
        const largura = await trilha.getDisplayWidth();
        const altura = await trilha.getDisplayHeight();
        const tamanho = Math.min(largura, altura) <= VIDEO.ladoMenor ? {}
          : largura <= altura ? { width: VIDEO.ladoMenor } : { height: VIDEO.ladoMenor };
        return {
          ...tamanho,
          codec: 'avc',
          frameRate: VIDEO.fps,
          quality: new Quality({ bitrate: VIDEO.bitrate }),
          forceTranscode: true,
        };
      },
      audio: { codec: 'aac' }, // áudio de celular já é AAC: copia sem recomprimir
    });

    // Trilha extra descartada por falta de espaço no MP4 tudo bem; imagem ou som perdido por codec, não.
    const perdida = conversao.discardedTracks.find((d) => MOTIVOS[d.reason]);
    if (perdida) {
      const qual = perdida.track.isAudioTrack() ? 'o som' : 'a imagem';
      throw new Error(`Não foi possível comprimir ${qual}: ${MOTIVOS[perdida.reason]}.`);
    }
    if (!conversao.isValid || !(await input.getPrimaryVideoTrack())) {
      throw new Error('Não foi possível comprimir: o arquivo não tem uma trilha de vídeo compatível.');
    }

    const aoCancelar = () => conversao.cancel();
    sinal?.addEventListener('abort', aoCancelar, { once: true });
    conversao.onProgress = (fracao) => aoProgredir(Math.min(fracao, 0.99));
    try {
      await conversao.execute();
    } catch (err) {
      if (sinal?.aborted) throw cancelado();
      throw err;
    } finally {
      sinal?.removeEventListener('abort', aoCancelar);
    }
    aoProgredir(1);
    return new File([output.target.buffer], trocarExtensao(arquivo.name, 'mp4'), { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}
