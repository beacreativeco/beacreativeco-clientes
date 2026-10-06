// Upload de arquivos grandes em partes para o R2, pelas funções /api/midias/*.
import { supabase } from './supabase.js';
import { tipoMime } from './conteudos.js';

const PARALELAS = 3;   // partes subindo ao mesmo tempo
const TENTATIVAS = 3;  // por parte, antes de desistir

async function tokenAtual() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

async function chamar(caminho, corpo) {
  const resp = await fetch(caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenAtual()}` },
    body: JSON.stringify(corpo),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.erro || 'Falha na comunicação com o servidor.');
  return json;
}

// XHR em vez de fetch: só ele informa o progresso do envio.
function enviarParte(url, blob, token, aoProgredir, sinal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) aoProgredir(e.loaded); };
    xhr.onload = () => {
      let json = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* corpo vazio */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(json);
      reject(Object.assign(new Error(json.erro || 'Falha ao enviar parte do arquivo.'), { status: xhr.status }));
    };
    xhr.onerror = () => reject(new Error('A conexão caiu durante o envio.'));
    xhr.onabort = () => reject(new DOMException('Envio cancelado.', 'AbortError'));
    sinal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

// Erro de rede, servidor fora ou sessão renovando: vale tentar de novo.
function valeTentarDeNovo(err) {
  if (err.name === 'AbortError') return false;
  return !err.status || err.status >= 500 || err.status === 401;
}

/**
 * Envia um arquivo e devolve a linha criada em `midias`.
 * @param {File} arquivo
 * @param {string} conteudoId
 * @param {{ aoProgredir?: (fracao: number) => void, sinal?: AbortSignal }} opcoes
 */
export async function enviarArquivo(arquivo, conteudoId, { aoProgredir = () => {}, sinal } = {}) {
  const { chave, uploadId, tamanhoParte } = await chamar('/api/midias/iniciar', {
    conteudo_id: conteudoId,
    nome: arquivo.name,
    tipo: tipoMime(arquivo),
    tamanho: arquivo.size,
  });

  const total = Math.ceil(arquivo.size / tamanhoParte);
  const carregado = new Array(total).fill(0);   // bytes já enviados de cada parte
  const partes = new Array(total);
  const avisar = () => aoProgredir(carregado.reduce((a, b) => a + b, 0) / arquivo.size);

  // Cancela todas as partes de uma vez: pedido da Bea ou falha definitiva de uma delas.
  const interno = new AbortController();
  sinal?.addEventListener('abort', () => interno.abort(), { once: true });

  async function enviar(n) {
    const inicio = (n - 1) * tamanhoParte;
    const blob = arquivo.slice(inicio, Math.min(inicio + tamanhoParte, arquivo.size));
    const url = `/api/midias/parte?chave=${encodeURIComponent(chave)}&uploadId=${encodeURIComponent(uploadId)}&n=${n}`;

    for (let tentativa = 1; ; tentativa++) {
      try {
        const parte = await enviarParte(url, blob, await tokenAtual(), (bytes) => {
          carregado[n - 1] = bytes;
          avisar();
        }, interno.signal);
        carregado[n - 1] = blob.size;
        avisar();
        partes[n - 1] = { partNumber: parte.partNumber, etag: parte.etag };
        return;
      } catch (err) {
        carregado[n - 1] = 0;
        if (tentativa >= TENTATIVAS || !valeTentarDeNovo(err)) throw err;
        await new Promise((r) => setTimeout(r, 1000 * tentativa));
      }
    }
  }

  try {
    let proxima = 1;
    const trabalhador = async () => {
      while (proxima <= total) {
        if (interno.signal.aborted) throw new DOMException('Envio cancelado.', 'AbortError');
        await enviar(proxima++);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALELAS, total) }, trabalhador));

    const { midia } = await chamar('/api/midias/concluir', { chave, uploadId, partes });
    return midia;
  } catch (err) {
    interno.abort();
    chamar('/api/midias/abortar', { chave, uploadId }).catch(() => {});
    throw err;
  }
}

export async function excluirMidia(midiaId) {
  await chamar('/api/midias/excluir', { midia_id: midiaId });
}

// Arquivos da conversa (imagens e áudios) de um conteúdo que vai ser excluído.
export async function limparArquivosDaConversa(conteudoId) {
  await chamar('/api/conversa/limpar', { conteudo_id: conteudoId });
}
