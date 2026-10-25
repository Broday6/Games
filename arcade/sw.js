// Pocket Arcade hub service worker. Each game registers its own worker for its own folder; this one only
// answers for the hub's files so it never shadows a game's cache.
const CACHE = 'arcade-hub-v3';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'apple-touch-icon.png', 'driftwood.svg', 'nighttide/icon-192.png', 'deepcast/icon-192.png', 'diceden/icon-192.png',
  'emberdeck/icon-192.png', 'tidewall/icon-192.png', 'highcard/icon-192.png', 'luckyreels/icon-192.png'];
const URLS = new Set(FILES.map((f) => new URL(f, self.registration.scope).href));

self.addEventListener('install', (e) => {
  // One missing file must not block the install, so cache them one by one.
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('arcade-hub-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url.split('#')[0].split('?')[0];
  if (e.request.method !== 'GET' || !URLS.has(url)) return;
  // Network first so a fresh hub shows up right away; the cache covers offline.
  e.respondWith(fetch(e.request)
    .then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    })
    .catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))));
});
