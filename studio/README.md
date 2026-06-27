# TALJOE Studios — PWA Integration Guide

## Files in this package

```
taljoe-pwa/
├── manifest.json        ← Web App Manifest
├── sw.js                ← Service Worker (caching, offline, push, background sync)
├── pwa-register.js      ← Client-side PWA registration script
├── offline.html         ← Offline fallback page
├── generate_icons.py    ← Icon generator (already run — icons/ is ready)
└── icons/
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png     ← maskable
    ├── icon-384.png
    └── icon-512.png     ← maskable
```

---

## Step-by-Step Integration

### 1. Copy files into your project

Place all files relative to your `index.html` inside `studio/`:

```
wdd231/
└── studio/
    ├── index.html          ← your existing file
    ├── manifest.json       ← ADD THIS
    ├── sw.js               ← ADD THIS
    ├── pwa-register.js     ← ADD THIS
    ├── offline.html        ← ADD THIS
    └── icons/              ← ADD THIS FOLDER
        └── icon-*.png
```

---

### 2. Add to your `<head>` in `index.html`

Paste these lines inside your `<head>` tag:

```html
<!-- PWA Manifest -->
<link rel="manifest" href="manifest.json" />

<!-- Theme color (matches your purple accent) -->
<meta name="theme-color" content="#6c63ff" />

<!-- iOS / Safari PWA support -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="TALJOE" />
<link rel="apple-touch-icon" href="icons/icon-192.png" />

<!-- Windows tile -->
<meta name="msapplication-TileImage" content="icons/icon-144.png" />
<meta name="msapplication-TileColor" content="#6c63ff" />
```

---

### 3. Add the registration script to your `<body>` in `index.html`

Just before the closing `</body>` tag:

```html
<script src="pwa-register.js" defer></script>
```

---

### 4. Update `sw.js` — add your real asset URLs

Open `sw.js` and edit the `PRECACHE_URLS` array to include all your CSS, JS,
and image files. For example:

```js
const PRECACHE_URLS = [
  '/wdd231/studio/',
  '/wdd231/studio/index.html',
  '/wdd231/studio/offline.html',
  '/wdd231/studio/manifest.json',
  '/wdd231/studio/styles/styles.css',   // ← your CSS
  '/wdd231/studio/scripts/main.js',     // ← your JS
  // add images, fonts, etc.
];
```

---

### 5. Update manifest.json if your URLs change

If your GitHub Pages URL or folder structure changes, update `start_url` and
`scope` in `manifest.json`.

---

### 6. Push to GitHub Pages

```bash
git add .
git commit -m "feat: add PWA support (manifest, service worker, offline page)"
git push
```

GitHub Pages serves over HTTPS, which is required for service workers. ✅

---

## What you get after integration

| Feature | Details |
|---|---|
| **Installable** | "Add to Home Screen" prompt on Android/iOS/desktop |
| **Offline** | Core pages work without internet; custom offline.html shown |
| **Fast loads** | Assets cached after first visit |
| **Background sync** | Contact form submissions queued when offline, sent when back online |
| **Push notifications** | Infrastructure ready (needs a push server to send notifications) |
| **App shortcuts** | Projects, Contact, Join Us shortcuts in the installed app |
| **Update banner** | Users notified when a new version is deployed |

---

## Optional: Better icons

The icons in `icons/` were generated with Pillow (simple gradient). For
production-quality icons, you can:

1. Use your actual logo and run the icons through https://maskable.app
2. Or use https://realfavicongenerator.net with your logo

Replace the files in `icons/` — the names must match exactly.

---

## Testing your PWA

1. Open Chrome DevTools → **Application** tab → **Manifest** to verify it loaded
2. Application → **Service Workers** to check SW is active
3. Lighthouse → **PWA** audit — aim for all green checks
4. Test offline: DevTools → Network → **Offline** checkbox → refresh

---

## Troubleshooting

**Service worker not registering?**
- Must be served over HTTPS (GitHub Pages ✅)
- `sw.js` must be at the root of its scope (`/wdd231/studio/sw.js`)

**Manifest not loading?**
- Check the file path in the `<link rel="manifest">` tag matches exactly

**Icons not showing?**
- Make sure the `icons/` folder is committed to your repository

---

Made for TALJOE Studios · Based in Masaka, building for the world 🌍
