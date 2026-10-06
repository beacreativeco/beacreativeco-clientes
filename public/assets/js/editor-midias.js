// Seção "Arquivos" do editor: lista na ordem, compressão e envio com progresso, mover, baixar e remover.
import { supabase } from './supabase.js';
import { avisar } from './ui.js';
import {
  FORMATOS, REGRAS_FORMATO, LIMITE_OTIMIZADO_MB, TIPOS_ARQUIVO, aceiteDoInput, problemaDoArquivo, tamanhoLegivel, tipoMime,
  expirou, avisarSeSumiu,
} from './conteudos.js';
import { enviarArquivo, excluirMidia } from './upload.js';
import { otimizarImagem, otimizarVideo } from './otimizar.js';

const lista = document.getElementById('lista-midias');
const fila = document.getElementById('fila-envio');
const input = document.getElementById('arquivos');
const area = document.getElementById('area-soltar');
const regraTexto = document.getElementById('regra-midias');
const modeloMidia = document.getElementById('modelo-midia');
const modeloEnvio = document.getElementById('modelo-envio');

let midias = [];          // linhas de `midias` da versão atual, em ordem
let formato = 'post';
let driveUrl = '';        // com Drive, "Baixar" leva ao original de lá
let envios = [];          // [{ arquivo, conteudoId, li, controle }]
let enviando = false;
let garantirConteudo;     // () => Promise<conteudoId> (cria o rascunho se ainda não existe)
let aoErro;
let aoMudar;              // avisa a prévia quando a lista muda

export function iniciarMidias(opcoes) {
  garantirConteudo = opcoes.garantirConteudo;
  aoErro = opcoes.aoErro;
  aoMudar = opcoes.aoMudar;

  input.addEventListener('change', () => {
    adicionar([...input.files]);
    input.value = '';
  });
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('arrastando'); });
  area.addEventListener('dragleave', () => area.classList.remove('arrastando'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('arrastando');
    adicionar([...e.dataTransfer.files]);
  });
  lista.addEventListener('click', aoClicarNaLista);
  fila.addEventListener('click', aoClicarNaFila);
  window.addEventListener('beforeunload', (e) => {
    if (envios.length) e.preventDefault();
  });
}

export async function carregarMidias(conteudo) {
  const { data, error } = await supabase
    .from('midias').select('*')
    .eq('conteudo_id', conteudo.id).eq('versao', conteudo.versao_atual)
    .order('ordem');
  if (error) throw error;
  midias = data;
  desenhar();
}

export function definirFormato(novo) {
  formato = novo;
  input.accept = aceiteDoInput(novo);
  regraTexto.textContent = REGRAS_FORMATO[novo].dica;
  lista.dataset.formato = novo;
  desenhar();
}

export function definirDrive(url) {
  driveUrl = /^https:\/\//.test(url || '') ? url : '';
  // Só os links: redesenhar recarregaria os vídeos a cada letra digitada.
  lista.querySelectorAll('.midia').forEach((li) => {
    const m = midias.find((x) => x.id === li.dataset.id);
    if (m) configurarBaixar(li.querySelector('[data-acao="baixar"]'), m);
  });
}

function configurarBaixar(link, m) {
  link.hidden = expirou(m.expira_em) && !driveUrl;
  link.href = driveUrl || `${m.arquivo_url}?download=1`;
  link.textContent = driveUrl ? 'Original (Drive)' : 'Baixar';
  if (driveUrl) {
    link.target = '_blank';
    link.rel = 'noopener';
  } else {
    link.removeAttribute('target');
    link.removeAttribute('rel');
  }
}

export const midiasAtuais = () => midias;
export const enviandoArquivos = () => envios.length > 0;

export async function excluirTodas() {
  for (const m of [...midias]) await excluirMidia(m.id);
  midias = [];
}

// ---------------------------------------------------------------- envio

async function adicionar(arquivos) {
  if (!arquivos.length) return;
  const problemas = [];
  let validos = arquivos.filter((a) => {
    const problema = problemaDoArquivo(a, formato);
    if (problema) problemas.push(problema);
    return !problema;
  });

  const { max } = REGRAS_FORMATO[formato];
  const cabem = Math.max(0, max - midias.length - envios.length);
  if (validos.length > cabem) {
    problemas.push(`${FORMATOS[formato]} aceita no máximo ${max} ${max === 1 ? 'arquivo' : 'arquivos'}.`
      + (cabem ? ` Só os primeiros ${cabem} vão subir.` : ' Remova algum antes de adicionar outro.'));
    validos = validos.slice(0, cabem);
  }
  if (problemas.length) aoErro(problemas.join(' '));
  if (!validos.length) return;

  let conteudoId;
  try {
    conteudoId = await garantirConteudo();
  } catch (err) {
    aoErro(err.message);
    return;
  }

  for (const arquivo of validos) {
    const li = modeloEnvio.content.firstElementChild.cloneNode(true);
    li.querySelector('.envio-nome').textContent = `${arquivo.name} (${tamanhoLegivel(arquivo.size / 1024 / 1024)})`;
    fila.append(li);
    envios.push({ arquivo, conteudoId, li, controle: new AbortController() });
  }
  fila.hidden = false;
  processarFila();
}

// Comprime no navegador e só então sobe (o original nunca vai pro sistema).
async function otimizar(arquivo, opcoes) {
  const tipo = TIPOS_ARQUIVO[tipoMime(arquivo)];
  const leve = tipo === 'video' ? await otimizarVideo(arquivo, opcoes) : await otimizarImagem(arquivo);
  if (leve.size > LIMITE_OTIMIZADO_MB[tipo] * 1024 * 1024) {
    throw new Error(`mesmo comprimido ficou com ${tamanhoLegivel(leve.size / 1024 / 1024)} `
      + `(limite de ${LIMITE_OTIMIZADO_MB[tipo]} MB).${tipo === 'video' ? ' Encurte o vídeo ou deixe só no Drive.' : ''}`);
  }
  return leve;
}

// Um arquivo por vez (cada um já sobe em partes paralelas).
async function processarFila() {
  if (enviando) return;
  enviando = true;
  while (envios.length) {
    const envio = envios[0];
    const barra = envio.li.querySelector('.envio-barra');
    const porcentagem = envio.li.querySelector('.envio-porcentagem');
    const etapa = (rotulo) => (fracao) => {
      barra.value = fracao;
      porcentagem.textContent = `${rotulo} ${Math.floor(fracao * 100)}%`;
    };
    try {
      etapa('Comprimindo')(0);
      const leve = await otimizar(envio.arquivo, { sinal: envio.controle.signal, aoProgredir: etapa('Comprimindo') });
      if (envio.controle.signal.aborted) throw new DOMException('Envio cancelado.', 'AbortError');
      envio.li.querySelector('.envio-nome').textContent =
        `${envio.arquivo.name} (${tamanhoLegivel(envio.arquivo.size / 1024 / 1024)} → ${tamanhoLegivel(leve.size / 1024 / 1024)})`;
      etapa('Enviando')(0);
      const midia = await enviarArquivo(leve, envio.conteudoId, {
        sinal: envio.controle.signal,
        aoProgredir: etapa('Enviando'),
      });
      midias.push(midia);
      desenhar();
      avisar(`${envio.arquivo.name} enviado.`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        aoErro(`${envio.arquivo.name}: ${err.message}`);
      }
    } finally {
      envio.li.remove();
      envios.shift();
    }
  }
  fila.hidden = true;
  enviando = false;
}

function aoClicarNaFila(e) {
  const botao = e.target.closest('[data-acao="cancelar"]');
  if (!botao) return;
  const i = envios.findIndex((env) => env.li.contains(botao));
  if (i < 0) return;
  if (i === 0) {
    envios[0].controle.abort(); // o finally do processarFila tira da fila
  } else {
    envios[i].li.remove();
    envios.splice(i, 1);
  }
}

// ---------------------------------------------------------------- lista

function desenhar() {
  lista.hidden = midias.length === 0;
  lista.replaceChildren(...midias.map((m, i) => {
    const li = modeloMidia.content.firstElementChild.cloneNode(true);
    li.dataset.id = m.id;
    li.querySelector('.midia-quadro').append(criarPrevia(m, i));
    li.querySelector('.midia-posicao').textContent = midias.length > 1 ? String(i + 1) : '';
    li.querySelector('.midia-tamanho').textContent =
      `${m.tipo === 'video' ? 'Vídeo' : 'Imagem'}, ${tamanhoLegivel(Number(m.tamanho_mb))}`;
    configurarBaixar(li.querySelector('[data-acao="baixar"]'), m);
    li.querySelector('[data-acao="antes"]').disabled = i === 0;
    li.querySelector('[data-acao="depois"]').disabled = i === midias.length - 1;
    li.querySelector('[data-acao="antes"]').hidden = midias.length < 2;
    li.querySelector('[data-acao="depois"]').hidden = midias.length < 2;
    return li;
  }));
  aoMudar?.();
}

// Apagado pela exclusão automática: aviso com o Drive (o original fica lá).
function avisoExpirado() {
  const aviso = document.createElement('p');
  aviso.className = 'midia-falha midia-expirada';
  aviso.textContent = driveUrl ? 'Arquivo expirado, veja no Drive.' : 'Arquivo expirado. O original está no Drive.';
  return aviso;
}

function criarPrevia(m, i) {
  if (expirou(m.expira_em)) return avisoExpirado();
  if (m.tipo === 'video') {
    const video = document.createElement('video');
    video.src = m.arquivo_url;
    video.controls = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.addEventListener('error', () => {
      const aviso = document.createElement('p');
      aviso.className = 'midia-falha';
      aviso.textContent = 'O navegador não conseguiu tocar este vídeo. Use Baixar para ver o arquivo.';
      video.replaceWith(aviso);
    }, { once: true });
    return video;
  }
  const img = new Image();
  img.src = m.arquivo_url;
  img.alt = `Arquivo ${i + 1}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  avisarSeSumiu(img, m.arquivo_url, avisoExpirado);
  return img;
}

async function aoClicarNaLista(e) {
  const botao = e.target.closest('button[data-acao]');
  if (!botao) return;
  const i = midias.findIndex((m) => m.id === botao.closest('.midia').dataset.id);
  if (i < 0) return;

  const acao = botao.dataset.acao;
  if (acao === 'antes') return mover(i, i - 1, botao);
  if (acao === 'depois') return mover(i, i + 1, botao);
  if (acao === 'remover') return remover(i, botao);
}

async function mover(de, para, botao) {
  if (para < 0 || para >= midias.length) return;
  botao.disabled = true;
  const reordenadas = [...midias];
  [reordenadas[de], reordenadas[para]] = [reordenadas[para], reordenadas[de]];
  // Renumera 0, 1, 2… (depois de remoções a ordem pode ter buracos).
  const mudancas = reordenadas
    .map((m, pos) => ({ m, pos }))
    .filter(({ m, pos }) => m.ordem !== pos)
    .map(({ m, pos }) => supabase.from('midias').update({ ordem: pos }).eq('id', m.id));
  const resultados = await Promise.all(mudancas);
  if (resultados.some((r) => r.error)) {
    aoErro('Não foi possível mudar a ordem. Recarregue a página.');
    botao.disabled = false;
    return;
  }
  reordenadas.forEach((m, pos) => { m.ordem = pos; });
  midias = reordenadas;
  desenhar();
}

// Dois cliques, como no "Excluir rascunho".
async function remover(i, botao) {
  if (!botao.dataset.confirmar) {
    botao.dataset.confirmar = '1';
    botao.textContent = 'Confirmar';
    setTimeout(() => {
      if (!botao.isConnected) return;
      delete botao.dataset.confirmar;
      botao.textContent = 'Remover';
    }, 4000);
    return;
  }
  botao.disabled = true;
  try {
    await excluirMidia(midias[i].id);
    midias.splice(i, 1);
    desenhar();
    avisar('Arquivo removido.');
  } catch (err) {
    aoErro(err.message);
    botao.disabled = false;
  }
}
