// Enviar pro Google Drive, direto do navegador da Bea (sem passar pelas Functions, então
// arquivo grande não esbarra no limite delas, e o original em alta qualidade pode ir).
//
// Permissão só `drive.file`: o sistema enxerga apenas o que ele mesmo criou ou o que a Bea
// escolheu no Google Picker. Por isso, na primeira vez com cada cliente, o Picker abre para
// ela escolher a pasta do Drive dele; o Google lembra dessa liberação nas próximas vezes.
// O token fica só na memória da página (nada guardado no servidor nem no navegador).
import { GOOGLE_CLIENT_ID, GOOGLE_API_KEY, GOOGLE_APP_ID } from './config.js';

const ESCOPO = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const PARTE = 8 * 1024 * 1024; // múltiplo de 256 KiB, como o Google exige

let token = null;       // { valor, expira } (ms)
let cliente = null;     // google.accounts.oauth2 token client
const scripts = new Map();

export const driveConfigurado = () => Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY && GOOGLE_APP_ID);

/** Id da pasta a partir do link do Drive (".../folders/<id>" ou "...?id=<id>"). */
export function idDaPasta(url) {
  const m = /\/folders\/([\w-]{10,})/.exec(url || '') ?? /[?&]id=([\w-]{10,})/.exec(url || '');
  return m?.[1] ?? null;
}

function carregar(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement('script'), { src, async: true });
      s.onload = resolve;
      s.onerror = () => {
        scripts.delete(src);
        reject(new Error('Não foi possível falar com o Google. Confira a internet e tente de novo.'));
      };
      document.head.append(s);
    }));
  }
  return scripts.get(src);
}

/** Baixa o script de login do Google antes do clique: a janelinha precisa abrir na hora. */
export function prepararDrive() {
  if (driveConfigurado()) carregar('https://accounts.google.com/gsi/client').catch(() => {});
}

/**
 * Token do Google (janelinha de login na primeira vez; depois, reaproveita até vencer).
 * Chamar direto no clique: o navegador bloqueia a janelinha se antes houver espera longa.
 */
export async function conectarDrive() {
  if (token && Date.now() < token.expira - 60_000) return token.valor;
  await carregar('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    cliente ??= window.google.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: ESCOPO, callback: () => {} });
    cliente.callback = (resp) => {
      if (resp.error) return reject(new Error('O Google não liberou o acesso ao Drive.'));
      token = { valor: resp.access_token, expira: Date.now() + Number(resp.expires_in) * 1000 };
      resolve(token.valor);
    };
    cliente.error_callback = (erro) => reject(new Error(erro?.type === 'popup_closed'
      ? 'A janela do Google foi fechada antes de liberar o Drive.'
      : 'O navegador bloqueou a janela do Google. Clique em "Enviar pro Drive" de novo.'));
    cliente.requestAccessToken({ prompt: '' });
  });
}

async function chamarDrive(caminho, valorToken) {
  const resp = await fetch(`${API}${caminho}`, { headers: { Authorization: `Bearer ${valorToken}` } });
  return resp;
}

/** O Picker para a Bea escolher (e assim liberar) a pasta do cliente. Devolve o id escolhido. */
async function escolherPasta(valorToken, nomeCliente) {
  await carregar('https://apis.google.com/js/api.js');
  await new Promise((resolve) => window.gapi.load('picker', resolve));
  const { picker } = window.google;
  return new Promise((resolve, reject) => {
    const visao = new picker.DocsView(picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setMimeTypes('application/vnd.google-apps.folder');
    const janela = new picker.PickerBuilder()
      .setTitle(`Escolha a pasta do Drive de ${nomeCliente}`)
      .setLocale('pt-BR')
      .setAppId(GOOGLE_APP_ID)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setOAuthToken(valorToken)
      .addView(visao)
      .setCallback((dados) => {
        if (dados.action === picker.Action.PICKED) resolve(dados.docs[0].id);
        else if (dados.action === picker.Action.CANCEL) reject(new Error('Nenhuma pasta escolhida.'));
      })
      .build();
    janela.setVisible(true);
  });
}

/**
 * Pasta de destino já liberada: confere a do cadastro do cliente e, se o sistema ainda não
 * tem acesso a ela, abre o Picker. Se a Bea escolher outra pasta, vale a escolhida.
 */
async function pastaLiberada(valorToken, { pastaUrl, nomeCliente }) {
  const doCadastro = idDaPasta(pastaUrl);
  if (doCadastro) {
    const resp = await chamarDrive(`/files/${doCadastro}?fields=id,capabilities(canAddChildren)&supportsAllDrives=true`, valorToken);
    if (resp.ok && (await resp.json()).capabilities?.canAddChildren) return { id: doCadastro, outra: false };
  }
  const escolhida = await escolherPasta(valorToken, nomeCliente);
  return { id: escolhida, outra: Boolean(doCadastro) && escolhida !== doCadastro };
}

// PUT de uma parte com XHR (só ele informa o progresso do envio).
function enviarParte(url, blob, inicio, total, aoProgredir) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Range', `bytes ${inicio}-${inicio + blob.size - 1}/${total}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) aoProgredir(inicio + e.loaded); };
    xhr.onload = () => {
      if (xhr.status === 308) return resolve(null); // parte aceita, continua
      if (xhr.status >= 200 && xhr.status < 300) return resolve(JSON.parse(xhr.responseText));
      reject(new Error('O Drive recusou o envio do arquivo.'));
    };
    xhr.onerror = () => reject(new Error('A conexão caiu durante o envio ao Drive.'));
    xhr.send(blob);
  });
}

/**
 * Envia um arquivo para a pasta do cliente no Drive.
 * @param {Blob} arquivo
 * @param {{ nome: string, pastaUrl: string, nomeCliente: string, aoProgredir?: (fracao: number) => void }} opcoes
 * @returns {Promise<{ id: string, url: string, outraPasta: boolean }>}
 */
export async function enviarProDrive(arquivo, { nome, pastaUrl, nomeCliente, aoProgredir = () => {} }) {
  if (!driveConfigurado()) throw new Error('O Drive ainda não está configurado no sistema.');
  const valorToken = await conectarDrive();
  const pasta = await pastaLiberada(valorToken, { pastaUrl, nomeCliente });

  const tipo = arquivo.type || 'application/octet-stream';
  const inicio = await fetch(`${UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${valorToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': tipo,
      'X-Upload-Content-Length': String(arquivo.size),
    },
    body: JSON.stringify({ name: nome, parents: [pasta.id] }),
  });
  if (!inicio.ok) {
    console.error('drive', inicio.status, await inicio.text());
    throw new Error(inicio.status === 404 || inicio.status === 403
      ? 'Sem permissão para salvar nessa pasta do Drive.'
      : 'Não foi possível começar o envio ao Drive.');
  }
  const sessao = inicio.headers.get('Location');

  let criado = null;
  for (let pos = 0; pos < arquivo.size; pos += PARTE) {
    const parte = arquivo.slice(pos, Math.min(pos + PARTE, arquivo.size));
    criado = await enviarParte(sessao, parte, pos, arquivo.size, (feito) => aoProgredir(feito / arquivo.size));
  }
  aoProgredir(1);
  return { id: criado.id, url: criado.webViewLink, outraPasta: pasta.outra };
}
