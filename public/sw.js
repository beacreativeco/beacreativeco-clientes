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

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(SEM_INTERNET, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })));
});
