// ====================================================
// MarketHub UG — PWA Registration & Install Prompt
// Include this in every HTML page (before </body>)
// ====================================================

(function () {
  'use strict';

  // ===== Service Worker Registration =====
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[PWA] SW registered:', reg.scope);

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });

        // Background sync registration
        if ('sync' in reg) {
          window.queueOrderForSync = async (orderData) => {
            try {
              await reg.sync.register('sync-orders');
              // Also post to SW for IndexedDB storage
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'QUEUE_ORDER',
                  order: orderData
                });
              }
              console.log('[PWA] Order queued for background sync');
            } catch (err) {
              console.warn('[PWA] Background sync not supported:', err);
            }
          };
        }

        // Push notification subscription
        if ('PushManager' in window) {
          window.subscribeToPush = async () => {
            try {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') return null;

              // VAPID public key — replace with your own from backend
              const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qByhKpRjYAe3dA0xRio';

              const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
              });

              // Send subscription to backend
              await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub)
              });

              console.log('[PWA] Push subscription active');
              return sub;
            } catch (err) {
              console.warn('[PWA] Push subscription failed:', err);
              return null;
            }
          };
        }

      } catch (err) {
        console.error('[PWA] SW registration failed:', err);
      }
    });

    // Listen for SW messages
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATED') showUpdateBanner();
    });
  }

  // ===== Install Prompt (Add to Home Screen) =====
  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    // Show custom install button after 3 seconds
    setTimeout(showInstallBanner, 3000);
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed!');
    hideInstallBanner();
    deferredInstallPrompt = null;
    // Track install event
    if (typeof gtag === 'function') gtag('event', 'pwa_install');
  });

  function showInstallBanner() {
    // Don't show if already dismissed or running as PWA
    if (localStorage.getItem('mh_install_dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div style="
        position:fixed; bottom:0; left:0; right:0; z-index:9998;
        background:#1A1A1A; color:#fff; padding:16px 20px;
        display:flex; align-items:center; gap:14px; flex-wrap:wrap;
        box-shadow:0 -4px 20px rgba(0,0,0,0.3);
      ">
        <svg width="40" height="40" viewBox="0 0 36 36" fill="none" style="flex-shrink:0">
          <rect width="36" height="36" rx="10" fill="#E8A020"/>
          <path d="M8 10h3l4 10 4-7 4 7 4-10h3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <circle cx="18" cy="27" r="3" fill="#fff"/>
        </svg>
        <div style="flex:1;min-width:180px">
          <strong style="display:block;font-size:0.95rem">Install MarketHub UG</strong>
          <span style="font-size:0.8rem;color:rgba(255,255,255,0.65)">Shop faster • Works offline • No app store needed</span>
        </div>
        <button onclick="installPWA()" style="
          background:#E8A020; color:#fff; border:none; padding:10px 20px;
          border-radius:8px; font-weight:700; font-size:0.9rem; cursor:pointer;
        ">Install App</button>
        <button onclick="dismissInstall()" style="
          background:transparent; color:rgba(255,255,255,0.5); border:none;
          font-size:1.4rem; cursor:pointer; padding:4px 8px; line-height:1;
        ">×</button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  function hideInstallBanner() {
    const b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
  }

  window.installPWA = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    if (outcome === 'accepted') hideInstallBanner();
    deferredInstallPrompt = null;
  };

  window.dismissInstall = () => {
    hideInstallBanner();
    localStorage.setItem('mh_install_dismissed', '1');
  };

  // ===== Update Banner =====
  function showUpdateBanner() {
    if (document.getElementById('pwa-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
      <div style="
        position:fixed; top:70px; right:16px; z-index:9999;
        background:#1A3A2A; color:#fff; padding:14px 18px; border-radius:12px;
        box-shadow:0 4px 20px rgba(0,0,0,0.25); max-width:320px;
        display:flex; align-items:center; gap:12px;
      ">
        <span style="font-size:1.4rem">🔄</span>
        <div style="flex:1">
          <strong style="display:block;font-size:0.9rem">Update Available</strong>
          <span style="font-size:0.78rem;color:rgba(255,255,255,0.7)">A new version of MarketHub is ready.</span>
        </div>
        <button onclick="applyUpdate()" style="
          background:#E8A020; color:#fff; border:none; padding:8px 14px;
          border-radius:8px; font-weight:700; font-size:0.82rem; cursor:pointer;
        ">Update</button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  window.applyUpdate = () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  // ===== Network Status Indicator =====
  function updateNetworkBadge(online) {
    let badge = document.getElementById('network-badge');
    if (!online) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'network-badge';
        badge.innerHTML = '📶 You\'re offline — browsing cached content';
        badge.style.cssText = `
          position:fixed; top:66px; left:50%; transform:translateX(-50%);
          background:#D93025; color:#fff; padding:8px 20px; border-radius:50px;
          font-size:0.8rem; font-weight:600; z-index:9997; white-space:nowrap;
          box-shadow:0 2px 10px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(badge);
      }
    } else {
      if (badge) {
        badge.style.background = '#1A7A3F';
        badge.textContent = '✓ Back online!';
        setTimeout(() => badge?.remove(), 2500);
      }
    }
  }

  window.addEventListener('online', () => updateNetworkBadge(true));
  window.addEventListener('offline', () => updateNetworkBadge(false));
  if (!navigator.onLine) updateNetworkBadge(false);

  // ===== Utility: VAPID key converter =====
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

})();