/**
 * Taljoe Fintech — Rate Limiting Middleware
 * server/middleware/rateLimit.middleware.js
 *
 * Different limits for different sensitivity levels:
 *   - Auth endpoints: strict (prevent brute force)
 *   - Payment endpoints: moderate (prevent fraud)
 *   - General API: generous (normal usage)
 */

'use strict';

const rateLimit = require('express-rate-limit');

const make = (windowMinutes, max, message) => rateLimit({
  windowMs:       windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: message },
  keyGenerator:    (req) => req.user?.id || req.ip, // per-user when authed
});

// Very strict — prevents brute-forcing passwords / PINs
const authLimiter = make(15, 10,
  'Too many authentication attempts. Please wait 15 minutes.'
);

// Per-user payment limits — prevents automated fraud
const paymentLimiter = make(60, 20,
  'Too many payment requests. Please slow down.'
);

// General API — prevents scraping / abuse
const apiLimiter = make(15, 200,
  'Too many requests. Please try again shortly.'
);

// Webhooks — must be very permissive (provider may send bursts)
const webhookLimiter = make(1, 500,
  'Webhook rate limit exceeded.'
);

module.exports = { authLimiter, paymentLimiter, apiLimiter, webhookLimiter };