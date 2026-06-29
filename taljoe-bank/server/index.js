/**
 * ================================================================
 * Taljoe Fintech — Main Server
 * server/index.js
 *
 * This file:
 *   1. Loads environment variables
 *   2. Configures Express with security middleware
 *   3. Mounts all API routes
 *   4. Serves the PWA frontend (public/)
 *   5. Starts the HTTP server
 *
 * Every incoming request flows through:
 *   helmet → cors → compression → morgan logging →
 *   rate limiting → body parsing → routes → error handler
 * ================================================================
 */

'use strict';

require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const morgan       = require('morgan');
const path         = require('path');

const logger       = require('./utils/logger');
const { ping }     = require('./config/database');
const { errorHandler, notFound } = require('./middleware/error.middleware');
const { authLimiter, paymentLimiter, apiLimiter, webhookLimiter } = require('./middleware/rateLimit.middleware');

// ── Route modules ─────────────────────────────────────────────────
const authRoutes    = require('./routes/auth.routes');
const accountRoutes = require('./routes/account.routes');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');

// ── App Setup ─────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 4000;
const ENV  = process.env.NODE_ENV || 'development';
const isProd = ENV === 'production';

// ── Trust proxy (needed behind Render / nginx for real IPs) ──────
app.set('trust proxy', 1);

// ── Security Headers (Helmet) ─────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],  // PWA inline scripts
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
      upgradeInsecureRequests: isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Allow service worker
}));

// ── CORS ──────────────────────────────────────────────────────────
// Allow the frontend origin (same domain in prod, localhost in dev)
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:4000',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods:          ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:   ['Content-Type', 'Authorization'],
  credentials:      true,
  maxAge:           86400, // Cache preflight for 24h
}));

// ── Compression ───────────────────────────────────────────────────
app.use(compression());

// ── Request Logging ───────────────────────────────────────────────
app.use(morgan(isProd ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Body Parsers ──────────────────────────────────────────────────
// Webhooks need raw body for signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString());
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── Static PWA (public/) ──────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, {
  maxAge: isProd ? '1d' : 0,
  etag:   true,
  setHeaders(res, filePath) {
    // Service worker must never be cached by browser
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Service-Worker-Allowed', '/');
    }
    if (filePath.endsWith('manifest.json')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
  },
}));

// ── Health Check ──────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    const dbTime = await ping();
    return res.json({
      status:  'ok',
      env:     ENV,
      db:      'connected',
      dbTime,
      ts:      new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Health check: DB unreachable', { error: err.message });
    return res.status(503).json({ status: 'degraded', db: 'unreachable', error: err.message });
  }
});

// ── API Routes ────────────────────────────────────────────────────
//
//  /api/auth/*        — register, login, refresh, logout, set-pin, me
//  /api/account/*     — balance, transactions, statement, kyc, lookup
//  /api/payments/*    — deposit, withdraw, transfer, status
//  /api/webhooks/*    — MTN and Airtel callback endpoints
//
app.use('/api/auth',      authLimiter,    authRoutes);
app.use('/api/account',   apiLimiter,     accountRoutes);
app.use('/api/payments',  paymentLimiter, paymentRoutes);
app.use('/api/webhooks',  webhookLimiter, webhookRoutes);

// ── SPA Fallback ──────────────────────────────────────────────────
// Any route not matched above serves the PWA index.html
// (React Router / client-side routing support)
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ── 404 + Error Handlers (must be last) ──────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────
if (require.main === module) {
  // Verify DB connection before accepting traffic
  ping()
    .then(() => {
      logger.info('Database connection established');
      app.listen(PORT, () => {
        logger.info(`Taljoe Fintech API running`, { port: PORT, env: ENV });
        logger.info(`Health: http://localhost:${PORT}/health`);
        logger.info(`API:    http://localhost:${PORT}/api`);
        logger.info(`App:    http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      logger.error('Cannot start server — database unreachable', { error: err.message });
      logger.error('Check DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD in your .env file');
      process.exit(1);
    });
}

module.exports = app; // exported for tests