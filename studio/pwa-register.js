/**
 * TALJOE Studios — PWA Registration Script
 * Add this as <script src="pwa-register.js" defer></script>
 * near the closing </body> tag of your index.html
 */

(function () {
  'use strict';

  // ─── Service Worker Registration ──────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/wdd231/studio/sw.js', {
          scope: '/wdd231/studio/',
        });
        console.log('[PWA] Service Worker registered. Scope:', registration.scope);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      } catch (err) {
        console.error('[PWA] Service Worker registration failed:', err);
      }
    });
  }

  // ─── Install Prompt (Add to Home Screen) ──────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
    console.log('[PWA] App installed successfully!');
  });

  function showInstallButton() {
    // Look for existing install button in your HTML (id="pwa-install-btn")
    // or dynamically create a floating button
    let btn = document.getElementById('pwa-install-btn');

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'pwa-install-btn';
      btn.innerHTML = '📲 Install App';
      btn.setAttribute('aria-label', 'Install TALJOE Studios app');
      Object.assign(btn.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '9999',
        background: 'linear-gradient(135deg, #6c63ff, #9b93ff)',
        color: '#fff',
        border: 'none',
        borderRadius: '50px',
        padding: '0.75rem 1.4rem',
        fontSize: '0.9rem',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(108,99,255,0.45)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        transition: 'transform 0.2s',
      });
      document.body.appendChild(btn);
    }

    btn.style.display = 'flex';
    btn.addEventListener('click', triggerInstall);
  }

  function hideInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'none';
  }

  async function triggerInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    deferredPrompt = null;
    hideInstallButton();
  }

  // ─── Update Banner ─────────────────────────────────────────
  function showUpdateBanner() {
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
      <span>🚀 A new version of TALJOE Studios is available!</span>
      <button id="pwa-update-btn">Update Now</button>
    `;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '10000',
      background: '#13131f',
      borderBottom: '2px solid #6c63ff',
      color: '#e8e8f0',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      fontSize: '0.9rem',
    });

    const updateBtn = banner.querySelector('#pwa-update-btn');
    Object.assign(updateBtn.style, {
      background: '#6c63ff',
      color: '#fff',
      border: 'none',
      borderRadius: '20px',
      padding: '0.4rem 1rem',
      cursor: 'pointer',
      fontWeight: '700',
      fontSize: '0.85rem',
      whiteSpace: 'nowrap',
    });

    updateBtn.addEventListener('click', () => {
      window.location.reload();
    });

    document.body.prepend(banner);
  }

  // ─── Offline / Online detection ────────────────────────────
  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    document.documentElement.classList.toggle('is-offline', !isOnline);

    if (!isOnline) {
      showOfflineToast();
    }
  }

  function showOfflineToast() {
    if (document.getElementById('pwa-offline-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'pwa-offline-toast';
    toast.textContent = '📡 You\'re offline — some features may be limited';
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#13131f',
      color: '#e8e8f0',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '50px',
      padding: '0.6rem 1.4rem',
      fontSize: '0.85rem',
      zIndex: '9998',
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    });

    document.body.appendChild(toast);

    window.addEventListener('online', () => {
      toast.remove();
    }, { once: true });
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // ─── Offline Form Queuing ──────────────────────────────────
  // Wrap form submissions to queue them when offline
  document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.querySelector('#contact form, form[data-form="contact"]');
    if (contactForm) {
      contactForm.addEventListener('submit', async (e) => {
        if (!navigator.onLine) {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(contactForm));
          await queueOfflineForm('pending-contacts', data);
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const reg = await navigator.serviceWorker.ready;
            await reg.sync.register('contact-form');
          }
          alert('You\'re offline. Your message has been saved and will be sent when you\'re back online.');
        }
      });
    }
  });

  async function queueOfflineForm(store, data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('taljoe-offline-db', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).add({ data, timestamp: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }
})();