// Seção "Arquivos" do editor: lista na ordem, compressão e envio com progresso, mover, baixar e remover.
import { supabase } from './supabase.js';
import { avisar } from './ui.js';
import {
  FORMATOS, REGRAS_FORMATO, LIMITE_OTIMIZADO_MB, TIPOS_ARQUIVO, aceiteDoInput, problemaDoArquivo, tamanhoLegivel, tipoMime,
  expirou, avisarSeSumiu,
} from './conteudos.js';
import { enviarArquivo, excluirMidia, anexarNoTrello } from './upload.js';
import { otimizarImagem, otimizarVideo } from './otimizar.js';
import { driveConfigurado, enviarProDrive, conectarDrive, prepararDrive } from './drive.js';

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
let trello = { cartao: null, url: null }; // cartão do conteúdo ("Enviar pro Trello" só com ele)
let destinoDrive = { pastaUrl: '', nomeCliente: '', titulo: '' };
// Originais (alta qualidade) dos arquivos enviados nesta página: o sistema só guarda a
// versão comprimida, então "Enviar pro Drive" só tem o original enquanto a página está aberta.
const originais = new Map(); // midia.id → File
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
  prepararDrive();
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

/** Cartão do Trello ligado ao conteúdo (id e link), ou nada. */
export function definirTrello({ cartao, url }) {
  trello = { cartao: cartao || null, url: url || null };
  lista.querySelectorAll('.midia').forEach((li) => {
    const m = midias.find((x) => x.id === li.dataset.id);
    if (m) configurarDestinos(li, m);
  });
}

/** Pasta do Drive do cliente e o título do conteúdo (nome do arquivo no Drive). */
export function definirDestinoDrive(destino) {
  destinoDrive = { ...destinoDrive, ...destino };
}

const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

// "✓ No Trello" / "✓ No Drive" (com link) depois de enviado; mandar de novo pede confirmação.
function configurarDestinos(li, m) {
  const feitoTrello = li.querySelector('[data-feito="trello"]');
  const botaoTrello = li.querySelector('[data-acao="trello"]');
  const noTrello = Boolean(m.trello_enviado_em);
  feitoTrello.hidden = !noTrello;
  feitoTrello.href = trello.url || m.trello_anexo_url || '#';
  feitoTrello.title = noTrello ? `Enviado em ${quando(m.trello_enviado_em)}`
    + (m.trello_como === 'link' ? ' (link: o arquivo passa de 10 MB, limite do Trello)' : '') : '';
  botaoTrello.hidden = !trello.cartao || (expirou(m.expira_em) && !noTrello);
  botaoTrello.textContent = noTrello ? 'Trello de novo' : 'Enviar pro Trello';
  delete botaoTrello.dataset.confirmar;

  const feitoDrive = li.querySelector('[data-feito="drive"]');
  const botaoDrive = li.querySelector('[data-acao="drive"]');
  const noDrive = Boolean(m.drive_enviado_em);
  feitoDrive.hidden = !noDrive;
  feitoDrive.href = m.drive_arquivo_url || '#';
  feitoDrive.textContent = noDrive && m.drive_original === false ? '✓ No Drive (versão do sistema)' : '✓ No Drive';
  feitoDrive.title = noDrive ? `Enviado em ${quando(m.drive_enviado_em)}` : '';
  botaoDrive.hidden = !driveConfigurado();
  botaoDrive.textContent = noDrive ? 'Drive de novo' : 'Enviar pro Drive';
  delete botaoDrive.dataset.confirmar;

  li.querySelector('.midia-destinos').hidden = botaoTrello.hidden && botaoDrive.hidden && !noTrello && !noDrive;
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
      originais.set(midia.id, envio.arquivo);
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
    configurarDestinos(li, m);
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
  if (acao === 'trello') return enviarProTrello(i, botao);
  if (acao === 'drive') return pedirDrive(i, botao);
  if (acao === 'drive-escolher') return escolherOriginal(i);
  if (acao === 'drive-sistema') return mandarProDrive(i, null);
  if (acao === 'drive-cancelar') botao.closest('.midia-escolha-original').hidden = true;
}

// ---------------------------------------------------------------- Drive

// Arquivo escolhido à mão (o original que está no computador da Bea).
const escolhaOriginal = Object.assign(document.createElement('input'), { type: 'file', hidden: true });
document.body.append(escolhaOriginal);

async function pedirDrive(i, botao) {
  const m = midias[i];
  // Já está no Drive: dois cliques, para não duplicar sem querer.
  if (m.drive_enviado_em && !botao.dataset.confirmar) {
    botao.dataset.confirmar = '1';
    botao.textContent = 'Confirmar envio';
    setTimeout(() => {
      if (!botao.isConnected || !botao.dataset.confirmar) return;
      delete botao.dataset.confirmar;
      botao.textContent = 'Drive de novo';
    }, 4000);
    return;
  }
  delete botao.dataset.confirmar;
  // Login do Google já no clique (a janelinha só abre como resposta direta a um clique).
  try {
    await conectarDrive();
  } catch (err) {
    aoErro(err.message);
    return;
  }
  const original = originais.get(m.id);
  if (original) return mandarProDrive(i, original);
  // Sem o original na página: a Bea escolhe o arquivo ou manda a versão do sistema.
  botao.textContent = m.drive_enviado_em ? 'Drive de novo' : 'Enviar pro Drive';
  botao.closest('.midia').querySelector('.midia-escolha-original').hidden = false;
}

function escolherOriginal(i) {
  const m = midias[i];
  escolhaOriginal.accept = m.tipo === 'video' ? 'video/*' : 'image/*';
  escolhaOriginal.onchange = () => {
    const arquivo = escolhaOriginal.files[0];
    escolhaOriginal.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith(m.tipo === 'video' ? 'video/' : 'image/')) {
      aoErro(`Escolha ${m.tipo === 'video' ? 'um vídeo' : 'uma imagem'}: este arquivo é ${m.tipo === 'video' ? 'vídeo' : 'imagem'}.`);
      return;
    }
    mandarProDrive(i, arquivo);
  };
  escolhaOriginal.click();
}

// `original`: File em alta qualidade; null = a versão comprimida que está no sistema.
async function mandarProDrive(i, original) {
  const m = midias[i];
  const li = lista.querySelector(`.midia[data-id="${m.id}"]`);
  const botao = li?.querySelector('[data-acao="drive"]');
  if (li) li.querySelector('.midia-escolha-original').hidden = true;
  if (botao) {
    botao.disabled = true;
    botao.textContent = 'Drive…';
  }
  try {
    let arquivo = original;
    let nome = original?.name;
    if (!arquivo) {
      const resp = await fetch(m.arquivo_url);
      if (!resp.ok) throw new Error('O arquivo não está mais no sistema (expirou).');
      arquivo = await resp.blob();
      const titulo = (destinoDrive.titulo || 'Conteúdo').replace(/[\\/:*?"<>|]+/g, ' ').trim();
      nome = `${titulo} - ${m.tipo === 'video' ? 'vídeo' : 'imagem'} ${i + 1}.${m.arquivo_url.split('.').pop()}`;
    }
    const enviado = await enviarProDrive(arquivo, {
      nome,
      pastaUrl: destinoDrive.pastaUrl,
      nomeCliente: destinoDrive.nomeCliente,
      aoProgredir: (fracao) => { if (botao) botao.textContent = `Drive ${Math.floor(fracao * 100)}%`; },
    });
    const { data, error } = await supabase.from('midias').update({
      drive_arquivo_id: enviado.id,
      drive_arquivo_url: enviado.url,
      drive_enviado_em: new Date().toISOString(),
      drive_original: Boolean(original),
    }).eq('id', m.id).select().single();
    if (error) throw new Error('Foi pro Drive, mas não deu para registrar aqui. Recarregue a página.');
    Object.assign(m, data);
    avisar((original ? 'Original enviado pro Drive.' : 'Versão do sistema enviada pro Drive.')
      + (enviado.outraPasta ? ' Foi na pasta que você escolheu, não na do cadastro do cliente.' : ''));
  } catch (err) {
    aoErro(err.message);
  } finally {
    if (botao) botao.disabled = false;
    if (li?.isConnected) configurarDestinos(li, m);
  }
}

async function enviarProTrello(i, botao) {
  const m = midias[i];
  const deNovo = Boolean(m.trello_enviado_em);
  // Já está no cartão: dois cliques, para não duplicar o anexo sem querer.
  if (deNovo && !botao.dataset.confirmar) {
    botao.dataset.confirmar = '1';
    botao.textContent = 'Confirmar envio';
    setTimeout(() => {
      if (!botao.isConnected || !botao.dataset.confirmar) return;
      delete botao.dataset.confirmar;
      botao.textContent = 'Trello de novo';
    }, 4000);
    return;
  }
  botao.disabled = true;
  botao.textContent = 'Enviando…';
  try {
    const { midia, como } = await anexarNoTrello(m.id, deNovo);
    Object.assign(m, midia);
    avisar(como === 'link'
      ? 'Passou de 10 MB (limite do Trello): foi o link do arquivo no sistema.'
      : 'Arquivo anexado no cartão do Trello.');
  } catch (err) {
    aoErro(err.message);
  } finally {
    botao.disabled = false;
    const li = botao.closest('.midia');
    if (li) configurarDestinos(li, m);
  }
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
