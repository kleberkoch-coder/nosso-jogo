/* Service worker do site da pelada.
   Ao publicar uma nova versão, troque o número abaixo para os celulares atualizarem. */
const VERSION = 'pelada-v40';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const CDN = u => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com' ||
  (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/'));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: tenta a rede primeiro (versão mais nova), mas espera no máximo 3 segundos.
  // Com sinal fraco ou sem internet, abre a cópia salva e atualiza em segundo plano.
  if (req.mode === 'navigate') {
    const net = fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); }
      return res;
    });
    e.waitUntil(net.then(() => {}, () => {}));
    e.respondWith(caches.match('./index.html').then(cached => {
      if (!cached) return net;
      const wait = new Promise(r => setTimeout(() => r(cached), 3000));
      return Promise.race([net.then(res => (res && res.ok) ? res : cached, () => cached), wait]);
    }));
    return;
  }

  // Arquivos do próprio site, fontes e biblioteca do Firebase: usa a cópia e atualiza em segundo plano.
  if (url.origin === location.origin || CDN(url)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
  // Dados (Firestore, login) passam direto: o próprio Firebase cuida do modo offline.
});
