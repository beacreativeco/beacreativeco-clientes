// Erros do navegador no Sentry, só na produção e no Preview (quem decide é /api/erros/config,
// que só devolve o DSN nesses dois endereços; no localhost nada é enviado).
// Sem Session Replay e sem desempenho (o pacote bundle.min.js só tem erros). Nada pessoal sai
// daqui: ids, e-mails, tokens e o que vem depois do "?" nas URLs são apagados, o console e os
// cliques não viram registro, e o usuário nunca é identificado.

// Versão fixa e conferida (SRI): trocar a versão = trocar o hash junto.
const SDK = 'https://browser.sentry-cdn.com/10.10.0/bundle.min.js';
const SDK_HASH = 'sha384-Lap3YoXP44X2Gi83/+Olb2c8JJp+2gYNk8DTSo2I91apZv8nxjMOJ1yF8iujbG42';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL = /[^\s@"'<>()[\]]+@[^\s@"'<>()[\]]+\.[a-z]{2,}/gi;
const TOKEN = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g;
// Endereço com "?" ou "#": fica só o caminho (query e fragmento levam ids e filtros).
const URL_COM_QUERY = /((?:https?:\/\/[^\s?#"'<>]+)|(?:^|(?<=[\s"'(]))\/[^\s?#"'<>]*)[?#][^\s"'<>)]*/g;

/** Tira de qualquer valor (texto, lista ou objeto) o que pode identificar alguém. */
export function limpar(valor, fundo = 0) {
  if (typeof valor === 'string') {
    return valor.replace(TOKEN, '<token>').replace(EMAIL, '<email>').replace(URL_COM_QUERY, '$1').replace(UUID, '<id>');
  }
  if (!valor || typeof valor !== 'object' || fundo > 10) return valor;
  if (Array.isArray(valor)) return valor.map((v) => limpar(v, fundo + 1));
  const saida = {};
  for (const [chave, v] of Object.entries(valor)) saida[chave] = limpar(v, fundo + 1);
  return saida;
}

/** Evento pronto para sair: sem usuário, sem cookies, só o navegador nos cabeçalhos. */
export function prepararEvento(evento) {
  const { user, ...resto } = evento;
  if (resto.request) {
    const agente = resto.request.headers?.['User-Agent'];
    resto.request = { ...resto.request, cookies: undefined, headers: agente ? { 'User-Agent': agente } : undefined };
  }
  return limpar(resto);
}

/** Console e cliques podem levar texto de mensagem: não viram registro. */
export function prepararRegistro(registro) {
  if (registro.category === 'console' || registro.category?.startsWith('ui.')) return null;
  return limpar(registro);
}

async function iniciar() {
  const resp = await fetch('/api/erros/config');
  const { dsn, ambiente } = resp.ok ? await resp.json() : {};
  if (!dsn) return;

  const script = document.createElement('script');
  script.src = SDK;
  script.integrity = SDK_HASH;
  script.crossOrigin = 'anonymous';
  script.addEventListener('load', () => {
    window.Sentry?.init({
      dsn,
      environment: ambiente,
      sendDefaultPii: false,
      maxBreadcrumbs: 30,
      denyUrls: [/^(chrome|moz|safari(-web)?)-extension:\/\//],
      beforeSend: prepararEvento,
      beforeBreadcrumb: prepararRegistro,
    });
  });
  document.head.append(script);
}

if (globalThis.document) iniciar().catch(() => { /* sem Sentry, o site segue igual */ });
