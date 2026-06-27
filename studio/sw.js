// TALJOE Studios — Service Worker v1.0
// Strategy: Cache-first for assets, network-first for HTML pages

const CACHE_NAME = 'taljoe-studios-v1';
const OFFLINE_URL = '/wdd231/studio/offline.html';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/wdd231/studio/',
  '/wdd231/studio/index.html',
  '/wdd231/studio/offline.html',
  '/wdd231/studio/manifest.json',
  // Add your CSS/JS files here — example:
  // '/wdd231/studio/styles/main.css',
  // '/wdd231/studio/scripts/main.js',
];

// ─── Install ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// ─── Activate ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (e.g. Google Maps embed)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // HTML pages → Network-first, fall back to cache, then offline page
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Static assets (CSS, JS, images, fonts) → Cache-first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Only cache successful same-origin responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Return a placeholder for missing images
          if (request.destination === 'image') {
            return new Response(
              `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
                <rect width="200" height="200" fill="#1a1a2e"/>
                <text x="50%" y="50%" fill="#6c63ff" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14">TJ</text>
              </svg>`,
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
        });
    })
  );
});

// ─── Background Sync (for form submissions) ────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'contact-form') {
    event.waitUntil(syncContactForm());
  }
  if (event.tag === 'job-application') {
    event.waitUntil(syncJobApplication());
  }
});

async function syncContactForm() {
  try {
    const db = await openDB();
    const pendingForms = await db.getAll('pending-contacts');
    for (const form of pendingForms) {
      // Replace with your actual form endpoint
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.data),
      });
      await db.delete('pending-contacts', form.id);
    }
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

async function syncJobApplication() {
  console.log('[SW] Job application sync triggered');
  // Implement similar to syncContactForm for job applications
}

// ─── Push Notifications ────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {
    title: 'TALJOE Studios',
    body: 'New update from TALJOE Studios!',
    icon: '/wdd231/studio/icons/icon-192.png',
    badge: '/wdd231/studio/icons/icon-96.png',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/wdd231/studio/icons/icon-192.png',
      badge: data.badge || '/wdd231/studio/icons/icon-96.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/wdd231/studio/' },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/wdd231/studio/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ─── Simple IndexedDB helper ───────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('taljoe-offline-db', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending-contacts')) {
        db.createObjectStore('pending-contacts', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending-applications')) {
        db.createObjectStore('pending-applications', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      resolve({
        getAll: (store) =>
          new Promise((res, rej) => {
            const tx = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          }),
        delete: (store, id) =>
          new Promise((res, rej) => {
            const tx = db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).delete(id);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
          }),
        add: (store, data) =>
          new Promise((res, rej) => {
            const tx = db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).add(data);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          }),
      });
    };
    request.onerror = () => reject(request.error);
  });
}