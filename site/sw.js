/* Service worker do site da pelada.
   Ao publicar uma nova versão, troque o número abaixo para os celulares atualizarem. */
const VERSION = 'pelada-v48';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
/* Preenchidas na montagem (build.mjs, KAN-149): pedaços de código do link público e da gestão. */
const CHUNKS = [];
const GESTAO = [];

/* Os pedaços da gestão só são guardados para usar sem internet nos aparelhos que já usaram a gestão
   (o celular de quem só confirma presença não baixa o que não usa). */
async function usouGestao() {
  for (const k of await caches.keys()) {
    if (k === VERSION) continue;
    const c = await caches.open(k);
    if ((await c.keys()).some(r => /\/chunks\/admin-/.test(r.url))) return true;
  }
  return false;
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(SHELL.concat(CHUNKS));
    if (await usouGestao()) await c.addAll(GESTAO).catch(() => {});
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  /* A página carregou a gestão: guarda os pedaços dela para abrir sem internet (KAN-149). */
  if (e.data === 'gestao') e.waitUntil(caches.open(VERSION).then(c => c.addAll(GESTAO)).catch(() => {}));
});

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
