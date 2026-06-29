/* ============================================================
   Taljoe Bank — Service Worker  (public/sw.js)
   Strategy: Cache-first for shell assets, network-first fallback.
   Version bump here forces cache refresh on next visit.
   ============================================================ */

const CACHE_VERSION = 'taljoe-bank-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/db.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install: pre-cache the app shell ─────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing cache:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove stale caches ────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating, clearing old caches');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, network fallback ─────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-same-origin requests
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(res => {
          // Only cache valid same-origin responses
          if (!res || res.status !== 200 || res.type !== 'basic') return res;

          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
          return res;
        });
      })
      .catch(() => {
        // Offline fallback: serve index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});