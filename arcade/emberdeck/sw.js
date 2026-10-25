// EMBER DECK service worker: precache everything, serve cache-first with network fallback.
const CACHE = 'emberdeck-v1';
const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'js/core.js',
  'js/cards.js',
  'js/relics.js',
  'js/enemies.js',
  'js/engine.js',
  'js/run.js',
  'js/events.js',
  'js/art.js',
  'js/audio.js',
  'js/fx.js',
  'js/ui.js',
  'js/views.js',
  'js/combat.js',
  'js/main.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('emberdeck-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => (e.request.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
