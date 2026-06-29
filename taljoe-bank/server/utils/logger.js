/**
 * Taljoe Fintech — Logger
 * src/utils/logger.js
 *
 * Structured JSON logging via Winston.
 * Production: JSON to stdout (picked up by log aggregators).
 * Development: colorized human-readable output.
 */

'use strict';

const winston = require('winston');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    isProd ? json() : combine(colorize(), simple())
  ),
  defaultMeta: { service: 'taljoe-fintech' },
  transports: [
    new winston.transports.Console(),
  ],
  // Don't crash on unhandled exceptions — log them
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

module.exports = logger;