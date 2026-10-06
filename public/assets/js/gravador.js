// Gravação de áudio no navegador para a conversa (estilo WhatsApp, com toques).
// Grava em M4A (AAC) quando o navegador sabe (Safari/iPhone, Chrome e Edge atuais); senão
// (Firefox) grava WEBM, que os navegadores atuais tocam. Não converte WEBM→M4A: onde o
// navegador grava WEBM, ele também não tem codificador AAC (testado com a Mediabunny).

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

// Quantas barras tem a onda guardada com a mensagem (a coluna aceita até 64).
export const BARRAS_ONDA = 40;

// Volume do microfone agora, de 0 a 1 (escala em decibéis, como o ouvido percebe).
function medidorDeVolume(stream) {
  try {
    const ctx = new AudioContext();
    ctx.resume().catch(() => {});
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 1024;
    // Ligado à saída com volume zero: o Safari só mede o que chega até o fim da cadeia.
    const mudo = ctx.createGain();
    mudo.gain.value = 0;
    ctx.createMediaStreamSource(stream).connect(analisador).connect(mudo).connect(ctx.destination);
    const amostras = new Float32Array(analisador.fftSize);
    return {
      medir() {
        analisador.getFloatTimeDomainData(amostras);
        let soma = 0;
        for (const a of amostras) soma += a * a;
        const db = 20 * Math.log10(Math.sqrt(soma / amostras.length) || 1e-8);
        return Math.min(1, Math.max(0, (db + 55) / 45)); // -55 dB (silêncio) a -10 dB (voz alta)
      },
      fechar: () => ctx.close().catch(() => {}),
    };
  } catch (err) {
    console.warn('Sem medidor de volume (as ondas ficam paradas).', err);
    return { medir: () => 0, fechar() {} };
  }
}

// Níveis medidos durante a gravação → BARRAS_ONDA alturas de 0 a 100.
function formaDaOnda(niveis) {
  if (!niveis.length) return null;
  const barras = Array.from({ length: BARRAS_ONDA }, (_, i) => {
    const de = Math.floor((i * niveis.length) / BARRAS_ONDA);
    const ate = Math.max(de + 1, Math.floor(((i + 1) * niveis.length) / BARRAS_ONDA));
    return Math.max(...niveis.slice(de, ate));
  });
  // Gravação baixa ainda mostra o desenho da fala; silêncio total fica reto (e mostra que algo deu errado).
  const pico = Math.max(...barras);
  const escala = pico > 0.08 ? 1 / pico : 1;
  return barras.map((b) => Math.round(Math.min(1, b * escala) * 100));
}

/**
 * Começa a gravar. Devolve o controle da gravação.
 * @param {{ aoTempo?: (segundos: number) => void, aoLimite?: () => void, aoNivel?: (nivel: number) => void }} opcoes
 *   aoNivel: volume do microfone (0 a 1) a cada 100 ms, para desenhar as ondas ao vivo.
 */
export async function gravar({ aoTempo = () => {}, aoLimite = () => {}, aoNivel = () => {} } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const tipo = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f)) ?? '';
  const gravador = new MediaRecorder(stream, { ...(tipo && { mimeType: tipo }), audioBitsPerSecond: 64000 });
  const partes = [];
  gravador.addEventListener('dataavailable', (e) => { if (e.data.size) partes.push(e.data); });

  const volume = medidorDeVolume(stream);
  const niveis = [];

  const inicio = performance.now();
  const segundos = () => Math.min(LIMITE_SEGUNDOS, (performance.now() - inicio) / 1000);
  let parouNoLimite = false;
  const relogio = setInterval(() => {
    if (gravador.state !== 'recording') return;
    const nivel = volume.medir();
    niveis.push(nivel);
    aoNivel(nivel);
    aoTempo(segundos());
    if (segundos() >= LIMITE_SEGUNDOS) {
      parouNoLimite = true;
      gravador.stop();
      aoLimite();
    }
  }, 100);

  const terminou = new Promise((resolve) => gravador.addEventListener('stop', resolve, { once: true }));
  gravador.start(1000);

  function soltarMicrofone() {
    clearInterval(relogio);
    volume.fechar();
    stream.getTracks().forEach((t) => t.stop());
  }

  return {
    /** Para e devolve { arquivo, duracao, onda } pronto para enviar. */
    async concluir() {
      const duracao = Math.round(segundos() * 10) / 10;
      if (gravador.state === 'recording') gravador.stop();
      await terminou;
      soltarMicrofone();
      const bruto = new Blob(partes, { type: (gravador.mimeType || tipo || 'audio/webm').split(';')[0] });
      return { arquivo: bruto, duracao: parouNoLimite ? LIMITE_SEGUNDOS : duracao, onda: formaDaOnda(niveis) };
    },
    cancelar() {
      if (gravador.state === 'recording') gravador.stop();
      soltarMicrofone();
    },
  };
}

export function relogio(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
