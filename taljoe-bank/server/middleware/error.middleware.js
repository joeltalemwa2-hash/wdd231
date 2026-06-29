/**
 * Taljoe Fintech — Error Middleware
 * server/middleware/error.middleware.js
 *
 * Catches all unhandled errors and returns consistent JSON.
 * Must be registered LAST in Express (after all routes).
 */

'use strict';

const logger = require('../utils/logger');

/**
 * Global error handler.
 * Express identifies this as error middleware because it has 4 params.
 */
const errorHandler = (err, req, res, _next) => {
  // Log with context
  logger.error('Unhandled error', {
    message:  err.message,
    stack:    process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path:     req.path,
    method:   req.method,
    userId:   req.user?.id,
  });

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }
  // Postgres foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  // Postgres check constraint violation (e.g. negative balance)
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Operation violates account constraints' });
  }

  const status  = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'An unexpected error occurred'
    : err.message;

  return res.status(status).json({ error: message, code: err.code });
};

/**
 * 404 handler — must be registered before errorHandler but after all routes.
 */
const notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
};

module.exports = { errorHandler, notFound };