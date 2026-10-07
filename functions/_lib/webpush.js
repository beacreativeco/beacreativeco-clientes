// Web Push sem pacote npm (as Functions não têm build): criptografia do conteúdo
// (RFC 8291, "aes128gcm") e assinatura VAPID (RFC 8292, JWT ES256), tudo com o WebCrypto
// da Cloudflare. Conferido contra o exemplo do Apêndice A da RFC 8291
// (scripts de teste fora do site: não ficam no repositório).
//
// Segredos: VAPID_PRIVATE_KEY (o "d" da chave P-256, base64url) e VAPID_SUBJECT
// (https://… ou mailto:…). A chave pública fica em public/assets/js/config.js.
import { rest } from './servidor.js';
import { VAPID_PUBLIC_KEY } from '../../public/assets/js/config.js';

const texto = new TextEncoder();

export function deBase64url(b64) {
  const limpo = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(limpo + '='.repeat((4 - (limpo.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function paraBase64url(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function juntar(...partes) {
  const total = partes.reduce((soma, p) => soma + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

async function hkdf(salt, ikm, info, tamanho) {
  const chave = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, chave, tamanho * 8);
  return new Uint8Array(bits);
}

// Chave P-256 a partir do "d" (privada) e do ponto público sem compressão (0x04 || x || y).
function jwkP256(d, publica) {
  return {
    kty: 'EC', crv: 'P-256', ext: true,
    x: paraBase64url(publica.slice(1, 33)),
    y: paraBase64url(publica.slice(33, 65)),
    ...(d && { d }),
  };
}

/**
 * Cifra o conteúdo para um aparelho (RFC 8291). `servidor` e `salt` só são passados no
 * teste (exemplo da RFC); no envio de verdade são novos a cada mensagem.
 */
export async function cifrar(conteudo, { p256dh, auth }, { servidor, salt } = {}) {
  const uaPublica = deBase64url(p256dh);
  const segredo = deBase64url(auth);
  salt ??= crypto.getRandomValues(new Uint8Array(16));

  let parServidor;
  let asPublica;
  if (servidor) {
    asPublica = deBase64url(servidor.publica);
    parServidor = {
      privateKey: await crypto.subtle.importKey('jwk', jwkP256(servidor.privada, asPublica),
        { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
    };
  } else {
    parServidor = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', parServidor.publicKey));
  }

  const uaChave = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaChave }, parServidor.privateKey, 256));

  const ikm = await hkdf(segredo, ecdh, juntar(texto.encode('WebPush: info\0'), uaPublica, asPublica), 32);
  const cek = await hkdf(salt, ikm, texto.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, texto.encode('Content-Encoding: nonce\0'), 12);

  // Um registro só: o conteúdo seguido do delimitador 0x02 (último registro, sem preenchimento).
  const claro = juntar(typeof conteudo === 'string' ? texto.encode(conteudo) : conteudo, new Uint8Array([2]));
  const chaveAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, chaveAes, claro));

  // Cabeçalho: salt (16) || tamanho do registro (4096, 4 bytes) || tamanho da chave (1) || chave pública (65)
  const cabecalho = juntar(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPublica.length]), asPublica);
  return juntar(cabecalho, cifrado);
}

// Assinatura VAPID: JWT ES256 com o endereço do serviço de push (aud), validade e contato.
async function vapid(env, endpoint) {
  const publica = deBase64url(VAPID_PUBLIC_KEY);
  const chave = await crypto.subtle.importKey('jwk', jwkP256(env.VAPID_PRIVATE_KEY, publica),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const corpo = (o) => paraBase64url(texto.encode(JSON.stringify(o)));
  const semAssinatura = `${corpo({ typ: 'JWT', alg: 'ES256' })}.${corpo({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT || 'https://clientes.beacreativeco.com.br',
  })}`;
  // O WebCrypto já devolve r || s (64 bytes), o formato que o JWT espera.
  const assinatura = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, texto.encode(semAssinatura));
  return `vapid t=${semAssinatura}.${paraBase64url(assinatura)}, k=${VAPID_PUBLIC_KEY}`;
}

/**
 * Manda um aviso para um aparelho. Devolve o status do serviço de push
 * (201 = entregue ao serviço; 404/410 = o aparelho não existe mais).
 * @param {{ titulo: string, corpo: string, url: string, tag?: string }} aviso
 */
export async function enviarPush(env, aparelho, aviso) {
  const corpo = await cifrar(JSON.stringify(aviso), aparelho);
  const resp = await fetch(aparelho.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapid(env, aparelho.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(24 * 60 * 60), // fora do ar por mais de um dia: o aviso já perdeu o sentido
      Urgency: 'high',
    },
    body: corpo,
  });
  if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
    console.error('push', resp.status, await resp.text().catch(() => ''));
  }
  return resp.status;
}

/**
 * Avisa todos os aparelhos de uma pessoa. Aparelho que não existe mais (404/410) é apagado.
 * Devolve quantos aparelhos receberam.
 */
export async function avisarUsuario(env, userId, aviso) {
  if (!env.VAPID_PRIVATE_KEY) {
    console.error('VAPID_PRIVATE_KEY não configurada: aviso não enviado');
    return 0;
  }
  const aparelhos = (await rest(env, `push_aparelhos?select=id,endpoint,p256dh,auth&user_id=eq.${userId}`)) ?? [];
  let entregues = 0;
  await Promise.all(aparelhos.map(async (a) => {
    try {
      const status = await enviarPush(env, a, aviso);
      if (status === 404 || status === 410) {
        await rest(env, `push_aparelhos?id=eq.${a.id}`, { metodo: 'DELETE', retornar: false });
      } else if (status >= 200 && status < 300) {
        entregues++;
        await rest(env, `push_aparelhos?id=eq.${a.id}`, {
          metodo: 'PATCH', retornar: false, corpo: { usado_em: new Date().toISOString() },
        });
      }
    } catch (err) {
      console.error('push', a.id, err);
    }
  }));
  return entregues;
}
