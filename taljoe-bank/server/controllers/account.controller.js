/**
 * Taljoe Fintech — Account Controller
 * server/controllers/account.controller.js
 *
 * Handles: balance, transaction history, account details, KYC submission
 */

'use strict';

const { body, query: qParam, validationResult } = require('express-validator');
const UserModel        = require('../models/user.model');
const TransactionModel = require('../models/transaction.model');
const AuditModel       = require('../models/audit.model');
const { query }        = require('../config/database');
const logger           = require('../utils/logger');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
};

const AccountController = {

  /**
   * GET /api/account/balance
   * Return current balance and account info.
   */
  async getBalance(req, res) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Account not found' });

      // Get month stats
      const { rows: [stats] } = await query(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'deposit'      AND status = 'completed' THEN amount ELSE 0 END), 0) AS month_deposits,
          COALESCE(SUM(CASE WHEN type = 'withdrawal'   AND status = 'completed' THEN amount ELSE 0 END), 0) AS month_withdrawals,
          COALESCE(SUM(CASE WHEN type = 'transfer_in'  AND status = 'completed' THEN amount ELSE 0 END), 0) AS month_transfers_in,
          COALESCE(SUM(CASE WHEN type = 'transfer_out' AND status = 'completed' THEN amount ELSE 0 END), 0) AS month_transfers_out,
          COUNT(*)                                                                                          AS month_tx_count
        FROM transactions
        WHERE account_id = $1
          AND created_at >= date_trunc('month', NOW())
      `, [user.account_id]);

      return res.json({
        balance:       user.balance,
        accountNumber: user.account_number,
        isFrozen:      user.is_frozen,
        currency:      'UGX',
        thisMonth: {
          deposits:      parseInt(stats.month_deposits),
          withdrawals:   parseInt(stats.month_withdrawals),
          transfersIn:   parseInt(stats.month_transfers_in),
          transfersOut:  parseInt(stats.month_transfers_out),
          transactions:  parseInt(stats.month_tx_count),
          net: parseInt(stats.month_deposits) + parseInt(stats.month_transfers_in)
             - parseInt(stats.month_withdrawals) - parseInt(stats.month_transfers_out),
        },
      });
    } catch (err) {
      logger.error('Get balance error', { error: err.message });
      return res.status(500).json({ error: 'Failed to fetch balance' });
    }
  },

  /**
   * GET /api/account/transactions
   * Paginated transaction history with optional type filter.
   *
   * Query params: ?page=1&limit=20&type=deposit|withdrawal|transfer_in|transfer_out
   */
  async getTransactions(req, res) {
    try {
      const page   = Math.max(1, parseInt(req.query.page  || '1'));
      const limit  = Math.min(100, parseInt(req.query.limit || '20'));
      const offset = (page - 1) * limit;
      const type   = req.query.type   || null;
      const status = req.query.status || null;

      const account = await UserModel.getAccount(req.user.id);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      const { transactions, total } = await TransactionModel.getHistory({
        accountId: account.id,
        limit,
        offset,
        type,
        status,
      });

      return res.json({
        transactions: transactions.map(formatTx),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      logger.error('Get transactions error', { error: err.message });
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  },

  /**
   * GET /api/account/transactions/:id
   * Single transaction detail.
   */
  async getTransaction(req, res) {
    try {
      const tx = await TransactionModel.findById(req.params.id, req.user.id);
      if (!tx) return res.status(404).json({ error: 'Transaction not found' });
      return res.json(formatTx(tx));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch transaction' });
    }
  },

  /**
   * GET /api/account/statement
   * Monthly statement summary with category breakdown.
   * Query params: ?year=2024&month=1  (month is 1-indexed)
   */
  async getStatement(req, res) {
    try {
      const year  = parseInt(req.query.year  || new Date().getFullYear());
      const month = parseInt(req.query.month || new Date().getMonth() + 1);

      const account = await UserModel.getAccount(req.user.id);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      const { rows } = await query(`
        SELECT
          type,
          category,
          COUNT(*)       AS count,
          SUM(amount)    AS total,
          AVG(amount)    AS average,
          MAX(amount)    AS largest,
          MIN(amount)    AS smallest
        FROM transactions
        WHERE account_id = $1
          AND status = 'completed'
          AND EXTRACT(YEAR  FROM created_at) = $2
          AND EXTRACT(MONTH FROM created_at) = $3
        GROUP BY type, category
        ORDER BY total DESC
      `, [account.id, year, month]);

      // Opening balance = balance minus all completed credits + all completed debits this month
      const { rows: [balRow] } = await query(`
        SELECT
          SUM(CASE WHEN type IN ('deposit','transfer_in')  AND status='completed' THEN amount ELSE 0 END) AS credits,
          SUM(CASE WHEN type IN ('withdrawal','transfer_out','fee') AND status='completed' THEN amount ELSE 0 END) AS debits
        FROM transactions
        WHERE account_id = $1
          AND EXTRACT(YEAR  FROM created_at) = $2
          AND EXTRACT(MONTH FROM created_at) = $3
      `, [account.id, year, month]);

      const credits = parseInt(balRow.credits || 0);
      const debits  = parseInt(balRow.debits  || 0);
      const closingBalance = account.balance;
      const openingBalance = closingBalance - credits + debits;

      return res.json({
        period: { year, month },
        openingBalance,
        closingBalance,
        totalCredits:  credits,
        totalDebits:   debits,
        net:           credits - debits,
        breakdown:     rows,
      });
    } catch (err) {
      logger.error('Get statement error', { error: err.message });
      return res.status(500).json({ error: 'Failed to generate statement' });
    }
  },

  /**
   * POST /api/account/kyc
   * Submit KYC documents for verification.
   */
  async submitKyc(req, res) {
    const rules = [
      body('docType').isIn(['national_id', 'passport', 'driving_license']).withMessage('Invalid document type'),
      body('docNumber').trim().notEmpty().withMessage('Document number required'),
      body('fullName').trim().isLength({ min: 2 }).withMessage('Full name required'),
      body('dateOfBirth').optional().isISO8601().withMessage('Invalid date format'),
    ];

    // Run rules manually
    for (const rule of rules) await rule.run(req);
    if (!validate(req, res)) return;

    try {
      const { docType, docNumber, fullName, dateOfBirth } = req.body;
      const { encrypt, hash } = require('../utils/encryption');

      // Check not already approved
      const user = await UserModel.findById(req.user.id);
      if (user.kyc_status === 'approved') {
        return res.status(400).json({ error: 'KYC already approved' });
      }

      await query(`
        INSERT INTO kyc_documents (user_id, doc_type, doc_number_hash, doc_number_enc, full_name, date_of_birth)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE
          SET doc_type       = EXCLUDED.doc_type,
              doc_number_hash = EXCLUDED.doc_number_hash,
              doc_number_enc  = EXCLUDED.doc_number_enc,
              full_name       = EXCLUDED.full_name,
              date_of_birth   = EXCLUDED.date_of_birth,
              submitted_at    = NOW()
      `, [
        req.user.id,
        docType,
        hash(docNumber),
        encrypt(docNumber),
        fullName,
        dateOfBirth || null,
      ]);

      // Auto-approve in sandbox/development
      if (process.env.NODE_ENV !== 'production') {
        await UserModel.updateKycStatus(req.user.id, 'approved', 'active');
        return res.json({
          message:   'KYC submitted and auto-approved (sandbox mode)',
          kycStatus: 'approved',
        });
      }

      await UserModel.updateKycStatus(req.user.id, 'pending');

      await AuditModel.log({
        userId:    req.user.id,
        eventType: 'kyc_submitted',
        eventData: { docType },
        ipAddress: req.ip,
      });

      return res.json({
        message:   'KYC documents submitted successfully. Review takes 1–2 business days.',
        kycStatus: 'pending',
      });
    } catch (err) {
      logger.error('KYC submission error', { error: err.message });
      return res.status(500).json({ error: 'KYC submission failed' });
    }
  },

  /**
   * GET /api/account/lookup/:accountNumber
   * Look up a Taljoe Bank account by number (for transfers).
   */
  async lookupAccount(req, res) {
    try {
      const account = await UserModel.getAccountByNumber(req.params.accountNumber);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      // Only return safe fields
      return res.json({
        accountNumber: account.account_number,
        name:          account.full_name,
        valid:         true,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Lookup failed' });
    }
  },
};

// ── Format a transaction for API response ─────────────────────────
function formatTx(tx) {
  return {
    id:              tx.id,
    type:            tx.type,
    status:          tx.status,
    channel:         tx.channel,
    amount:          tx.amount,
    fee:             tx.fee,
    netAmount:       tx.net_amount,
    balanceBefore:   tx.balance_before,
    balanceAfter:    tx.balance_after,
    currency:        tx.currency || 'UGX',
    description:     tx.description,
    category:        tx.category,
    providerRef:     tx.provider_tx_id,
    counterpart:     tx.counterpart_account ? {
      accountNumber: tx.counterpart_account,
      name:          tx.counterpart_name,
    } : null,
    failureReason:   tx.failure_reason,
    createdAt:       tx.created_at,
    completedAt:     tx.completed_at,
  };
}

module.exports = AccountController;