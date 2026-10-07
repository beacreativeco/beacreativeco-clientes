// Service worker do app instalado (PWA). Não guarda nada em cache: sem build, não há como
// trocar o nome do cache a cada deploy, e um cache velho serviria HTML/JS antigos (foi o que
// quebrou o LAEG-BIO para quem já tinha instalado). Tudo vem da rede; só a navegação sem
// internet ganha uma página simples, em vez do dinossauro do navegador.
// /api/ e arquivos (vídeo com Range) nem passam por aqui: o navegador busca direto.

const SEM_INTERNET = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem internet · BeaCreative</title>
<style>
  body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 16px;
    background: #FFF5E9; color: #4D3B31; font: 400 1rem/1.5 system-ui, -apple-system, sans-serif; text-align: center; }
  h1 { font: 500 1.6rem/1.2 Georgia, serif; margin: 0 0 8px; }
  button { margin-top: 16px; padding: 10px 22px; border: 0; border-radius: 999px;
    background: #7B85CE; color: #fff; font: 600 0.95rem system-ui, sans-serif; cursor: pointer; }
</style></head>
<body><main><h1>Sem internet</h1><p>Confira a conexão e tente de novo.</p>
<button type="button" onclick="location.reload()">Tentar de novo</button></main></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// ---------------------------------------------------------------- notificações push
// O servidor (functions/_lib/webpush.js) manda { titulo, corpo, url, tag }. Avisos com a
// mesma tag (a mesma conversa) se substituem em vez de empilhar. Se a pessoa já está com
// aquela tela aberta e em foco, não avisa de novo (a própria tela mostra a novidade).
const caminhoSeguro = (url) => (typeof url === 'string' && /^\/(?!\/)/.test(url) ? url : '/');

self.addEventListener('push', (event) => {
  let aviso = {};
  try {
    aviso = event.data?.json() ?? {};
  } catch {
    aviso = { corpo: event.data?.text() };
  }
  const url = caminhoSeguro(aviso.url);
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const destino = new URL(url, self.location.origin);
    const naTela = janelas.some((j) => {
      const aqui = new URL(j.url);
      return j.focused && j.visibilityState === 'visible'
        && aqui.pathname === destino.pathname && aqui.search === destino.search;
    });
    // No Safari (iPhone e Mac) todo push tem que virar aviso: o WebKit cancela a inscrição
    // de quem recebe push "silencioso". Lá o aviso sai mesmo com a tela aberta.
    const ua = self.navigator.userAgent;
    const safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|Android/.test(ua);
    if (naTela && aviso.tag !== 'teste' && !safari) return;
    await self.registration.showNotification(aviso.titulo || 'BeaCreative', {
      body: aviso.corpo || '',
      icon: '/android-chrome-192x192.png',
      badge: '/badge-96x96.png',
      tag: aviso.tag || undefined,
      renotify: Boolean(aviso.tag),
      data: { url },
    });
  })());
});

// Tocar no aviso: usa uma janela do sistema que já esteja aberta (indo para a tela certa)
// ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(caminhoSeguro(event.notification.data?.url), self.location.origin).href;
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const janela = janelas.find((j) => new URL(j.url).origin === self.location.origin);
    if (janela) {
      await janela.focus();
      if (janela.url !== url) await janela.navigate(url).catch(() => self.clients.openWindow(url));
      return;
    }
    await self.clients.openWindow(url);
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(SEM_INTERNET, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })));
});
