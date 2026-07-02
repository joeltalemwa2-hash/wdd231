// ====================================================
// MarketHub UG — Service Worker v1.0
// Offline-first with cache-then-network strategy
// ====================================================

const SW_VERSION = 'mh-v1.0.0';
const CACHE_STATIC = `${SW_VERSION}-static`;
const CACHE_DYNAMIC = `${SW_VERSION}-dynamic`;
const CACHE_IMAGES = `${SW_VERSION}-images`;
const CACHE_API = `${SW_VERSION}-api`;

// Assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pages/products.html',
  '/pages/product-detail.html',
  '/pages/cart.html',
  '/pages/checkout.html',
  '/pages/order-success.html',
  '/pages/vendors.html',
  '/pages/sell.html',
  '/pages/account.html',
  '/pages/about.html',
  '/css/style.css',
  '/js/data.js',
  '/js/cart.js',
  '/js/main.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap',
];

// ===== INSTALL — Pre-cache static assets =====
self.addEventListener('install', event => {
  console.log('[SW] Installing…', SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log('[SW] Pre-caching static assets');
        // Cache each individually so one failure doesn't block all
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE — Clean old caches =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating…', SW_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('mh-') && ![CACHE_STATIC, CACHE_DYNAMIC, CACHE_IMAGES, CACHE_API].includes(k))
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH — Routing strategies =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and POST requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // 1. API requests — Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // 2. Google Fonts — Cache first (long-lived)
  if (url.hostname.includes('fonts.g') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // 3. Images — Cache first, fetch and cache on miss
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, CACHE_IMAGES));
    return;
  }

  // 4. Static app shell (HTML, CSS, JS) — Stale-while-revalidate
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname === '/'
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 5. Everything else — Network first
  event.respondWith(networkFirst(request));
});

// ===== STRATEGY: Cache First =====
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return offlineFallback(request);
  }
}

// ===== STRATEGY: Stale While Revalidate =====
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_DYNAMIC);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || offlineFallback(request);
}

// ===== STRATEGY: Network First =====
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_DYNAMIC);
    const cached = await cache.match(request);
    return cached || offlineFallback(request);
  }
}

// ===== STRATEGY: Network First for API (with offline queue) =====
async function networkFirstAPI(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_API);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_API);
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return a JSON offline error
    return new Response(JSON.stringify({ error: 'offline', message: 'No network connection. Please try again.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ===== Offline Fallback =====
async function offlineFallback(request) {
  if (request.destination === 'document') {
    const cache = await caches.open(CACHE_STATIC);
    return cache.match('/offline.html') || new Response('<h1>You are offline</h1><p>Please check your connection.</p>', { headers: { 'Content-Type': 'text/html' } });
  }
  return new Response('Offline', { status: 503 });
}

// ===== BACKGROUND SYNC — Retry queued orders when online =====
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCartData());
  }
});

async function syncPendingOrders() {
  try {
    const db = await openDB();
    const orders = await getAllFromStore(db, 'pending_orders');
    for (const order of orders) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order.data)
        });
        if (res.ok) {
          await deleteFromStore(db, 'pending_orders', order.id);
          self.registration.showNotification('Order Confirmed! 🎉', {
            body: `Your order ${order.data.ref} has been placed successfully.`,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            tag: 'order-' + order.data.ref,
            data: { url: '/pages/order-success.html?ref=' + order.data.ref }
          });
        }
      } catch (err) {
        console.warn('[SW] Failed to sync order:', order.id, err);
      }
    }
  } catch (err) {
    console.error('[SW] syncPendingOrders failed:', err);
  }
}

async function syncCartData() {
  // Cart sync placeholder — extend as needed
  console.log('[SW] Cart sync triggered');
}

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  let data = { title: 'MarketHub UG', body: 'You have a new notification!', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: data.image || null,
    tag: data.tag || 'mh-notification',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ===== IndexedDB helpers for offline queue =====
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('markethub-offline', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending_orders'))
        db.createObjectStore('pending_orders', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('cart_backup'))
        db.createObjectStore('cart_backup', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteFromStore(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===== MESSAGE CHANNEL (from app to SW) =====
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'QUEUE_ORDER') {
    openDB().then(db => {
      const tx = db.transaction('pending_orders', 'readwrite');
      tx.objectStore('pending_orders').add({ data: event.data.order, timestamp: Date.now() });
    });
  }
  if (event.data?.type === 'CACHE_URLS') {
    caches.open(CACHE_DYNAMIC).then(cache => cache.addAll(event.data.urls || []));
  }
});

console.log('[SW] Loaded:', SW_VERSION);