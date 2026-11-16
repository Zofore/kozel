/* Online game: do not cache auth, API responses, sockets, or old client bundles. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Козёл</title><body style="background:#1a1a2e;color:#f0c674;font:18px system-ui;text-align:center;padding:40px"><h1>Козёл</h1><p>Для игры необходимо подключение к интернету.</p><button onclick="location.reload()" style="padding:12px;font:inherit">Повторить</button></body></html>',
    {headers:{'Content-Type':'text/html; charset=utf-8'},status:503}
  )));
});
