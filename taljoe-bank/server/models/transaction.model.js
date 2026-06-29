/**
 * Taljoe Fintech — Transaction Model
 * src/models/transaction.model.js
 *
 * Core financial ledger. Every money movement goes through here.
 * Uses database transactions to guarantee atomicity — balance
 * and transaction record are always in sync.
 */

'use strict';

const { query, withTransaction } = require('../config/database');
const { encrypt }                = require('../utils/encryption');
const logger                     = require('../utils/logger');

const TransactionModel = {

  /**
   * Credit an account (deposit / transfer_in).
   * Atomically creates the transaction record AND updates the balance.
   *
   * @param {object} opts
   * @param {string} opts.accountId
   * @param {string} opts.userId
   * @param {string} opts.type         - 'deposit' | 'transfer_in'
   * @param {string} opts.channel      - 'mtn_momo' | 'airtel_money' | 'internal' etc
   * @param {number} opts.amount       - UGX amount (positive integer)
   * @param {number} opts.fee          - fee in UGX (default 0)
   * @param {string} [opts.description]
   * @param {string} [opts.category]
   * @param {string} [opts.providerTxId]
   * @param {object} [opts.providerResponse]
   * @param {string} [opts.counterpartAccount]
   * @param {string} [opts.counterpartName]
   * @param {string} [opts.counterpartPhone]
   * @param {string} [opts.ipAddress]
   * @returns {Promise<{transaction, newBalance}>}
   */
  async credit(opts, client) {
    const {
      accountId, userId, type, channel, amount, fee = 0,
      description, category, providerTxId, providerResponse,
      counterpartAccount, counterpartName, counterpartPhone, ipAddress,
    } = opts;

    const netAmount = amount; // full amount credited (fee charged separately if any)

    const run = async (c) => {
      // Reset daily spend if day rolled over
      await c.query('SELECT reset_daily_spend_if_needed($1)', [accountId]);

      // Lock row for update to prevent race conditions
      const { rows: [acc] } = await c.query(
        'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE',
        [accountId]
      );

      const balBefore = acc.balance;
      const balAfter  = balBefore + netAmount;

      // Update balance
      await c.query(
        'UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
        [balAfter, accountId]
      );

      // Insert transaction record
      const { rows: [tx] } = await c.query(`
        INSERT INTO transactions (
          account_id, user_id, type, status, channel,
          amount, fee, net_amount, balance_before, balance_after,
          description, category, provider_tx_id, provider_response,
          counterpart_account, counterpart_name, counterpart_phone,
          ip_address, completed_at
        ) VALUES (
          $1,$2,$3,'completed',$4,
          $5,$6,$7,$8,$9,
          $10,$11,$12,$13,
          $14,$15,$16,
          $17::inet, NOW()
        )
        RETURNING *
      `, [
        accountId, userId, type, channel,
        amount, fee, netAmount, balBefore, balAfter,
        description, category, providerTxId, providerResponse ? JSON.stringify(providerResponse) : null,
        counterpartAccount, counterpartName,
        counterpartPhone ? encrypt(counterpartPhone) : null,
        ipAddress,
      ]);

      return { transaction: tx, newBalance: balAfter };
    };

    // If a client is passed (already in a transaction), use it; otherwise create one
    return client ? run(client) : withTransaction(run);
  },

  /**
   * Debit an account (withdrawal / transfer_out).
   * Validates balance before deducting.
   */
  async debit(opts, client) {
    const {
      accountId, userId, type, channel, amount, fee = 0,
      description, category, providerTxId, providerResponse,
      counterpartAccount, counterpartName, counterpartPhone, ipAddress,
    } = opts;

    const totalDeducted = amount + fee;

    const run = async (c) => {
      await c.query('SELECT reset_daily_spend_if_needed($1)', [accountId]);

      const { rows: [acc] } = await c.query(
        'SELECT balance, daily_spent, is_frozen FROM accounts WHERE id = $1 FOR UPDATE',
        [accountId]
      );

      if (acc.is_frozen) throw Object.assign(new Error('Account is frozen'), { code: 'ACCOUNT_FROZEN' });
      if (acc.balance < totalDeducted) throw Object.assign(new Error('Insufficient balance'), { code: 'INSUFFICIENT_FUNDS' });

      const dailyLimit = parseInt(process.env.DAILY_TRANSACTION_LIMIT || '10000000');
      if (acc.daily_spent + amount > dailyLimit) {
        throw Object.assign(new Error('Daily transaction limit exceeded'), { code: 'DAILY_LIMIT_EXCEEDED' });
      }

      const balBefore = acc.balance;
      const balAfter  = balBefore - totalDeducted;

      await c.query(`
        UPDATE accounts
        SET balance = $1, daily_spent = daily_spent + $2, updated_at = NOW()
        WHERE id = $3
      `, [balAfter, amount, accountId]);

      const { rows: [tx] } = await c.query(`
        INSERT INTO transactions (
          account_id, user_id, type, status, channel,
          amount, fee, net_amount, balance_before, balance_after,
          description, category, provider_tx_id, provider_response,
          counterpart_account, counterpart_name, counterpart_phone,
          ip_address, completed_at
        ) VALUES (
          $1,$2,$3,'completed',$4,
          $5,$6,$7,$8,$9,
          $10,$11,$12,$13,
          $14,$15,$16,
          $17::inet, NOW()
        )
        RETURNING *
      `, [
        accountId, userId, type, channel,
        amount, fee, totalDeducted, balBefore, balAfter,
        description, category, providerTxId, providerResponse ? JSON.stringify(providerResponse) : null,
        counterpartAccount, counterpartName,
        counterpartPhone ? encrypt(counterpartPhone) : null,
        ipAddress,
      ]);

      return { transaction: tx, newBalance: balAfter };
    };

    return client ? run(client) : withTransaction(run);
  },

  /**
   * Create a PENDING transaction (used while waiting for provider callback).
   */
  async createPending({ accountId, userId, type, channel, amount, fee = 0,
    description, category, providerTxId, ipAddress }) {
    const { rows: [acc] } = await query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    const { rows: [tx] } = await query(`
      INSERT INTO transactions (
        account_id, user_id, type, status, channel,
        amount, fee, net_amount, balance_before, balance_after,
        description, category, provider_tx_id, ip_address
      ) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$8,$9,$10,$11,$12::inet)
      RETURNING *
    `, [
      accountId, userId, type, channel,
      amount, fee, amount + fee, acc.balance,
      description, category, providerTxId, ipAddress,
    ]);
    return tx;
  },

  /**
   * Update a pending transaction to completed/failed.
   */
  async updateStatus(txId, status, { providerTxId, providerResponse, failureReason } = {}) {
    const { rows: [tx] } = await query(`
      UPDATE transactions
      SET status            = $2,
          provider_tx_id    = COALESCE($3, provider_tx_id),
          provider_response = COALESCE($4::jsonb, provider_response),
          failure_reason    = $5,
          completed_at      = CASE WHEN $2 = 'completed' THEN NOW() ELSE NULL END,
          updated_at        = NOW()
      WHERE id = $1
      RETURNING *
    `, [txId, status, providerTxId, providerResponse ? JSON.stringify(providerResponse) : null, failureReason]);
    return tx;
  },

  /**
   * Get transaction history for an account.
   */
  async getHistory({ accountId, limit = 20, offset = 0, type, status }) {
    let sql = `
      SELECT * FROM transactions
      WHERE account_id = $1
    `;
    const params = [accountId];
    let i = 2;

    if (type)   { sql += ` AND type = $${i++}`;   params.push(type); }
    if (status) { sql += ` AND status = $${i++}`; params.push(status); }

    sql += ` ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);

    // Total count for pagination
    const countSql = `SELECT COUNT(*) FROM transactions WHERE account_id = $1${type ? ' AND type = $2' : ''}`;
    const countParams = type ? [accountId, type] : [accountId];
    const { rows: [{ count }] } = await query(countSql, countParams);

    return { transactions: rows, total: parseInt(count) };
  },

  /**
   * Get single transaction by ID (must belong to user).
   */
  async findById(txId, userId) {
    const { rows } = await query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [txId, userId]
    );
    return rows[0] || null;
  },

  /**
   * Find transaction by provider reference.
   */
  async findByProviderId(providerTxId) {
    const { rows } = await query(
      'SELECT * FROM transactions WHERE provider_tx_id = $1',
      [providerTxId]
    );
    return rows[0] || null;
  },
};

module.exports = TransactionModel;