/**
 * Taljoe Fintech — Database Configuration
 * src/config/database.js
 *
 * Uses pg (node-postgres) connection pool.
 * All queries go through this pool — never create bare clients.
 */

'use strict';

const { Pool } = require('pg');
const logger   = require('../utils/logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'taljoe_bank',
  user:     process.env.DB_USER     || 'taljoe_admin',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,

  // Pool settings
  max:              20,    // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log pool errors (don't crash the server on idle client errors)
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

/**
 * Execute a single query.
 * @param {string} text     - SQL string (use $1, $2... for params)
 * @param {Array}  [params] - Query parameters
 * @returns {Promise<QueryResult>}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Query executed', { text, duration, rows: result.rowCount });
    }
    return result;
  } catch (err) {
    logger.error('Database query error', { text, error: err.message });
    throw err;
  }
};

/**
 * Get a client from the pool for transactions.
 * Always call client.release() when done.
 * @returns {Promise<PoolClient>}
 */
const getClient = () => pool.connect();

/**
 * Run a function inside a database transaction.
 * Automatically commits on success, rolls back on error.
 *
 * @param {Function} fn - async (client) => result
 * @returns {Promise<any>}
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   await client.query('UPDATE accounts SET balance = ...');
 *   await client.query('INSERT INTO transactions ...');
 *   return 'done';
 * });
 */
const withTransaction = async (fn) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Test database connectivity (used in health check).
 */
const ping = async () => {
  const result = await query('SELECT NOW() as ts');
  return result.rows[0].ts;
};

module.exports = { query, getClient, withTransaction, ping, pool };