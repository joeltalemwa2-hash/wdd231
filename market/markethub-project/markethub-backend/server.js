// ====================================================
// MarketHub UG — Backend Server
// Express + MongoDB REST API
// ====================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARE =====
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS — allow frontend origin
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:5500',   // VS Code Live Server
    'http://127.0.0.1:5500',
    /\.github\.io$/,           // GitHub Pages
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api/', globalLimiter);

// ===== DATABASE =====
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/markethub', {
  serverSelectionTimeoutMS: 5000,
}).then(() => {
  console.log('✓ MongoDB connected');
}).catch(err => {
  console.error('✗ MongoDB connection error:', err.message);
  console.log('  Tip: Start MongoDB with: mongod --dbpath ./data');
});

mongoose.connection.on('disconnected', () => console.warn('⚠ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✓ MongoDB reconnected'));

// ===== ROUTES =====
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/vendors',  require('./routes/vendors'));
app.use('/api/cart',     require('./routes/cart'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/push',     require('./routes/push'));
app.use('/api/upload',   require('./routes/upload'));
app.use('/api/delivery', require('./routes/delivery'));

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    env: process.env.NODE_ENV || 'development',
  });
});

// ===== SERVE FRONTEND (production) =====
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../markethub')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../markethub', 'index.html'));
    }
  });
}

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`\n🚀 MarketHub UG API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;