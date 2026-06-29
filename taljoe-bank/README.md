# 🏦 Taljoe Bank PWA

Personal finance manager for Uganda — track deposits, withdrawals, savings goals, and SACCO investments.
Works offline. Installable on any phone or desktop.

---

## 📁 Project Structure

```
taljoe-bank/
│
├── public/                        ← NO CHANGES HERE (frontend stays as-is)
│   ├── index.html
│   ├── sw.js
│   ├── manifest.json
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── db.js
│   │   └── app.js
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
│
├── server/
│   ├── index.js                   ← REPLACE this file (add API routes to it)
│   ├── index.test.js              ← keep as-is
│   │
│   │   ── NEW FOLDERS INSIDE server/ ──────────────────────────────
│   │
│   ├── config/
│   │   └── database.js            ← NEW — paste src/config/database.js here
│   │
│   ├── models/
│   │   ├── user.model.js          ← NEW — paste src/models/user.model.js
│   │   ├── transaction.model.js   ← NEW — paste src/models/transaction.model.js
│   │   └── audit.model.js         ← NEW — paste src/models/audit.model.js
│   │
│   ├── services/
│   │   ├── mtn-momo.service.js    ← NEW — paste src/services/mtn-momo.service.js
│   │   ├── airtel.service.js      ← NEW — paste src/services/airtel.service.js
│   │   └── payment.service.js     ← NEW — paste src/services/payment.service.js
│   │
│   ├── middleware/
│   │   └── auth.middleware.js     ← NEW — paste src/middleware/auth.middleware.js
│   │
│   ├── routes/                    ← NEW FOLDER (to be built next)
│   │   ├── auth.routes.js
│   │   ├── account.routes.js
│   │   └── payment.routes.js
│   │
│   ├── controllers/               ← NEW FOLDER (to be built next)
│   │   ├── auth.controller.js
│   │   ├── account.controller.js
│   │   └── payment.controller.js
│   │
│   └── utils/
│       ├── logger.js              ← NEW — paste src/utils/logger.js
│       └── encryption.js          ← NEW — paste src/utils/encryption.js
│
├── migrations/                    ← NEW FOLDER at root level
│   ├── 001_initial_schema.sql     ← NEW — the database schema
│   └── run.js                     ← NEW — the migration runner
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── Dockerfile
├── docker-compose.yml
├── render.yaml
├── package.json                   ← REPLACE with the new one (adds pg, bcryptjs, etc.)
├── .eslintrc.json
├── .gitignore
├── .env.example                   ← REPLACE with the new one (adds DB, MTN, Airtel keys)
└── README.md
```

---

## 🚀 STEP-BY-STEP: From Zero to Live

### STEP 1 — Prerequisites (install once)

| Tool | Why | Install |
|------|-----|---------|
| Node.js 18+ | Run the server | https://nodejs.org |
| Git | Version control | https://git-scm.com |
| A GitHub account | Host code + CI/CD | https://github.com |

Verify installs:
```bash
node -v     # should print v18.x.x or higher
npm -v      # should print 9.x.x or higher
git --version
```

---

### STEP 2 — Get the code onto your machine

```bash
# Option A: if you downloaded the zip
unzip taljoe-bank.zip
cd taljoe-bank

# Option B: if you cloned from GitHub
git clone https://github.com/YOUR-USERNAME/taljoe-bank.git
cd taljoe-bank
```

---

### STEP 3 — Install dependencies

```bash
npm install
```

This reads `package.json` and downloads Express, Helmet, and other packages into `node_modules/`.

---

### STEP 4 — Run locally (development)

```bash
npm run dev
```

Open your browser to **http://localhost:3000**

You should see the PIN screen. The default PIN is **1234**.

> Tip: `npm run dev` uses `nodemon` which auto-restarts the server when you edit files in `server/`.
> Editing `public/` files (HTML, CSS, JS) takes effect on browser refresh with no restart needed.

---

### STEP 5 — Run the tests

```bash
npm test
```

Expected output:
```
PASS server/index.test.js
  Taljoe Bank Server
    ✓ GET / returns 200 and HTML
    ✓ GET /health returns ok
    ✓ GET /nonexistent falls back to index.html
    ✓ Security headers are present
```

---

### STEP 6 — Push to GitHub

```bash
# First time: create a new repo on github.com, then:
git init
git add .
git commit -m "Initial commit — Taljoe Bank PWA"
git remote add origin https://github.com/YOUR-USERNAME/taljoe-bank.git
git branch -M main
git push -u origin main
```

After every change:
```bash
git add .
git commit -m "describe what you changed"
git push
```

GitHub Actions will automatically run your tests on every push.

---

### STEP 7 — Deploy to Render (free hosting)

Render.com gives you a free Node.js host with HTTPS, auto-deploy, and a public URL.

1. Go to **https://render.com** and sign up (use your GitHub account).
2. Click **New → Web Service**.
3. Connect your GitHub repo (`taljoe-bank`).
4. Render will detect `render.yaml` automatically and fill in all settings.
5. Click **Create Web Service**.
6. Wait ~2 minutes. Your app is live at:
   `https://taljoe-bank.onrender.com`  *(or similar URL)*

**Auto-deploy:** Every time you `git push` to `main`, Render rebuilds and redeploys automatically.

---

### STEP 8 — Enable the Render deploy webhook in GitHub Actions (optional)

This makes GitHub Actions trigger Render after a successful build:

1. In Render dashboard → your service → **Settings → Deploy Hook** → copy the URL.
2. In GitHub repo → **Settings → Secrets and variables → Actions → New secret**:
   - Name: `RENDER_DEPLOY_HOOK`
   - Value: the URL you copied
3. Done. The CI pipeline now deploys automatically after every passing test.

---

### STEP 9 — Install the PWA on your phone

**Android (Chrome):**
1. Open your app URL in Chrome.
2. Tap the three-dot menu → **Add to Home Screen**.
3. Or: the app shows an install banner automatically.

**iPhone (Safari):**
1. Open your app URL in Safari.
2. Tap the share icon → **Add to Home Screen**.
3. Tap **Add**.

The app now lives on your home screen, launches fullscreen, and works offline.

---

### STEP 10 — Optional: Use Docker (advanced)

If you want to run the app in a container:

```bash
# Build the image
docker build -t taljoe-bank .

# Run it
docker run -p 3000:3000 taljoe-bank

# Or use docker-compose
docker compose up -d
```

---

## 🔧 Common Tasks

### Change the default PIN
Edit `public/js/db.js`:
```js
const defaultSettings = () => ({ name: 'Your Name', pin: '1234', darkMode: true });
//                                                          ^^^^^ change this
```

### Add a new withdrawal category
Edit the `<select id="with-cat">` in `public/index.html`.

### Update the app version / force cache refresh
In `public/sw.js`, bump the version:
```js
const CACHE_VERSION = 'taljoe-bank-v2';   // was v1
```

---

## 🛡️ Security Notes

- All data is stored in **localStorage** — it never leaves the user's device.
- The PIN is stored as plain text in localStorage. This is suitable for a personal app.
  For multi-user production use, add server-side authentication (JWT, sessions).
- The Express server uses `helmet` for security headers and `express-rate-limit` to prevent abuse.

---

## 📄 License

MIT — do whatever you want with it.