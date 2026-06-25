const CACHE = 'taljoe-v1';
const FILES = [
  '/taljoe/index.html',
  '/taljoe/taljoe-bank.html',
  '/taljoe/taljoe-bank-link.html',
  '/taljoe/manifest.json',
  '/taljoe/icons/icon-192.png',
  '/taljoe/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});