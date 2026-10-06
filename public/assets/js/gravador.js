// Gravação de áudio no navegador para a conversa (estilo WhatsApp, com toques).
// Grava em M4A (AAC) quando o navegador sabe (Safari/iPhone e Chrome atual); senão grava
// WEBM e converte para M4A com a Mediabunny, para tocar em qualquer celular. Se a
// conversão não for possível (ex.: Firefox), fica em WEBM, que os navegadores atuais tocam.

const MEDIABUNNY = 'https://cdn.jsdelivr.net/npm/mediabunny@1.61.3/dist/bundles/mediabunny.min.mjs';

export const LIMITE_SEGUNDOS = 180;

const FORMATOS = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

export function gravacaoDisponivel() {
  return Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

// Mensagem para a pessoa quando o microfone não abre.
export function motivoDoErro(err) {
  if (!window.isSecureContext) return 'O microfone só funciona com o site em endereço seguro (https).';
  if (!gravacaoDisponivel()) return 'Este navegador não grava áudio. Use o Chrome, o Safari ou o Edge atualizados.';
  if (err?.name === 'NotAllowedError') {
    return 'O microfone está bloqueado. Libere no cadeado ao lado do endereço do site (no iPhone: Ajustes > Safari > Microfone).';
  }
  if (err?.name === 'NotFoundError') return 'Nenhum microfone encontrado neste aparelho.';
  return 'Não foi possível abrir o microfone. Tente de novo.';
}

/**
 * Começa a gravar. Devolve o controle da gravação.
 * @param {{ aoTempo?: (segundos: number) => void, aoLimite?: () => void }} opcoes
 */
export async function gravar({ aoTempo = () => {}, aoLimite = () => {} } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const tipo = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f)) ?? '';
  const gravador = new MediaRecorder(stream, { ...(tipo && { mimeType: tipo }), audioBitsPerSecond: 64000 });
  const partes = [];
  gravador.addEventListener('dataavailable', (e) => { if (e.data.size) partes.push(e.data); });

  const inicio = performance.now();
  const segundos = () => Math.min(LIMITE_SEGUNDOS, (performance.now() - inicio) / 1000);
  let parouNoLimite = false;
  const relogio = setInterval(() => {
    aoTempo(segundos());
    if (segundos() >= LIMITE_SEGUNDOS && gravador.state === 'recording') {
      parouNoLimite = true;
      gravador.stop();
      aoLimite();
    }
  }, 200);

  const terminou = new Promise((resolve) => gravador.addEventListener('stop', resolve, { once: true }));
  gravador.start(1000);

  function soltarMicrofone() {
    clearInterval(relogio);
    stream.getTracks().forEach((t) => t.stop());
  }

  return {
    /** Para e devolve { arquivo, duracao } pronto para enviar. */
    async concluir() {
      const duracao = Math.round(segundos() * 10) / 10;
      if (gravador.state === 'recording') gravador.stop();
      await terminou;
      soltarMicrofone();
      const bruto = new Blob(partes, { type: (gravador.mimeType || tipo || 'audio/webm').split(';')[0] });
      return { arquivo: await paraM4a(bruto), duracao: parouNoLimite ? LIMITE_SEGUNDOS : duracao };
    },
    cancelar() {
      if (gravador.state === 'recording') gravador.stop();
      soltarMicrofone();
    },
  };
}

// WEBM (Opus) → M4A (AAC). Já é M4A, ou não dá para converter: devolve como está.
async function paraM4a(blob) {
  if (blob.type === 'audio/mp4') return blob;
  try {
    const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS, canEncodeAudio, Quality } =
      await import(MEDIABUNNY);
    if (!(await canEncodeAudio('aac'))) return blob;
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversao = await Conversion.init({ input, output, audio: { codec: 'aac', quality: new Quality({ bitrate: 64000 }) } });
    if (!conversao.isValid) return blob;
    await conversao.execute();
    input.dispose();
    return new Blob([output.target.buffer], { type: 'audio/mp4' });
  } catch (err) {
    console.warn('Áudio enviado em WEBM (não deu para converter para M4A).', err);
    return blob;
  }
}

export function relogio(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
