/**
 * Taljoe Fintech — Payment Controller
 * server/controllers/payment.controller.js
 *
 * Handles: deposit, withdrawal, internal transfer,
 *          provider webhooks, transaction status polling
 */

'use strict';

const { body, param, validationResult } = require('express-validator');
const PaymentService   = require('../services/payment.service');
const TransactionModel = require('../models/transaction.model');
const UserModel        = require('../models/user.model');
const AuditModel       = require('../models/audit.model');
const logger           = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
};

const ipOf = (req) => req.ip || req.connection?.remoteAddress;

const UGX_PHONE_REGEX = /^(\+?256|0)(7[0-9])\d{7}$/;

// ── Validation rule sets ──────────────────────────────────────────

const depositRules = [
  body('phone')
    .trim()
    .matches(UGX_PHONE_REGEX)
    .withMessage('Enter a valid Uganda MTN or Airtel number (e.g. 0771234567)'),
  body('amount')
    .isInt({ min: 500, max: 5000000 })
    .withMessage('Amount must be between UGX 500 and UGX 5,000,000'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Note must be under 200 characters'),
];

const withdrawRules = [
  body('phone')
    .trim()
    .matches(UGX_PHONE_REGEX)
    .withMessage('Enter a valid Uganda MTN or Airtel number'),
  body('amount')
    .isInt({ min: 500, max: 5000000 })
    .withMessage('Amount must be between UGX 500 and UGX 5,000,000'),
  body('pin')
    .matches(/^\d{4}$/)
    .withMessage('PIN must be 4 digits'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 200 }),
];

const transferRules = [
  body('toAccountNumber')
    .trim()
    .matches(/^TJ-\d{7}$/)
    .withMessage('Enter a valid Taljoe Bank account number (e.g. TJ-0001234)'),
  body('amount')
    .isInt({ min: 100, max: 5000000 })
    .withMessage('Amount must be between UGX 100 and UGX 5,000,000'),
  body('pin')
    .matches(/^\d{4}$/)
    .withMessage('PIN must be 4 digits'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 200 }),
];

// ── Controller ────────────────────────────────────────────────────

const PaymentController = {

  depositRules,
  withdrawRules,
  transferRules,

  /**
   * POST /api/payments/deposit
   *
   * Initiates a Mobile Money deposit.
   * Sends a USSD push to the customer's phone.
   * Returns a transactionId to poll for status.
   *
   * Body: { phone, amount, note? }
   */
  async deposit(req, res) {
    if (!validate(req, res)) return;

    // KYC check — must be at least active (pending_kyc users can deposit in sandbox)
    const user = await UserModel.findById(req.user.id);
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    try {
      const result = await PaymentService.initiateDeposit({
        userId:    req.user.id,
        phone:     req.body.phone,
        amount:    parseInt(req.body.amount),
        note:      req.body.note,
        ipAddress: ipOf(req),
      });

      return res.status(202).json({
        message:       result.message,
        transactionId: result.transactionId,
        providerRef:   result.providerRef,
        status:        result.status,
        next:          `Poll GET /api/payments/status/${result.transactionId} to confirm`,
      });
    } catch (err) {
      logger.error('Deposit controller error', { error: err.message, userId: req.user.id });
      const status = err.code === 'AMOUNT_TOO_SMALL' || err.code === 'AMOUNT_TOO_LARGE' ? 400
                   : err.code === 'UNKNOWN_PROVIDER' ? 400
                   : 500;
      return res.status(status).json({ error: err.message, code: err.code });
    }
  },

  /**
   * POST /api/payments/withdraw
   *
   * Initiates a Mobile Money withdrawal.
   * Deducts from balance immediately, sends to wallet.
   * If provider fails, balance is automatically reversed.
   *
   * Body: { phone, amount, pin, note? }
   */
  async withdraw(req, res) {
    if (!validate(req, res)) return;

    const user = await UserModel.findById(req.user.id);
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }
    if (user.kyc_status !== 'approved' && process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error:   'KYC verification required before withdrawals',
        code:    'KYC_REQUIRED',
        message: 'Please submit your national ID via POST /api/account/kyc',
      });
    }

    try {
      const result = await PaymentService.initiateWithdrawal({
        userId:    req.user.id,
        phone:     req.body.phone,
        amount:    parseInt(req.body.amount),
        pin:       req.body.pin,
        note:      req.body.note,
        ipAddress: ipOf(req),
      });

      return res.json({
        message:       result.message,
        transactionId: result.transactionId,
        providerRef:   result.providerRef,
        fee:           result.fee,
        newBalance:    result.newBalance,
        status:        result.status,
      });
    } catch (err) {
      logger.error('Withdrawal controller error', { error: err.message, userId: req.user.id });
      const status = err.code === 'INVALID_PIN'          ? 401
                   : err.code === 'INSUFFICIENT_FUNDS'   ? 400
                   : err.code === 'ACCOUNT_FROZEN'        ? 403
                   : err.code === 'DAILY_LIMIT_EXCEEDED'  ? 400
                   : err.code === 'KYC_REQUIRED'          ? 403
                   : 500;
      return res.status(status).json({ error: err.message, code: err.code });
    }
  },

  /**
   * POST /api/payments/transfer
   *
   * Internal transfer between two Taljoe Bank accounts.
   * Instant, no fees, no provider needed.
   *
   * Body: { toAccountNumber, amount, pin, note? }
   */
  async transfer(req, res) {
    if (!validate(req, res)) return;

    try {
      const result = await PaymentService.internalTransfer({
        fromUserId:      req.user.id,
        toAccountNumber: req.body.toAccountNumber,
        amount:          parseInt(req.body.amount),
        pin:             req.body.pin,
        note:            req.body.note,
        ipAddress:       ipOf(req),
      });

      return res.json({
        message:       `UGX ${result.amount.toLocaleString()} sent to ${result.recipient.name}`,
        transactionId: result.transactionId,
        amount:        result.amount,
        recipient:     result.recipient,
        newBalance:    result.newBalance,
        status:        'completed',
      });
    } catch (err) {
      logger.error('Transfer controller error', { error: err.message, userId: req.user.id });
      const status = err.code === 'INVALID_PIN'         ? 401
                   : err.code === 'INSUFFICIENT_FUNDS'  ? 400
                   : err.code === 'ACCOUNT_NOT_FOUND'   ? 404
                   : err.code === 'ACCOUNT_FROZEN'      ? 403
                   : 500;
      return res.status(status).json({ error: err.message, code: err.code });
    }
  },

  /**
   * GET /api/payments/status/:transactionId
   *
   * Poll for deposit/withdrawal status.
   * Returns current status; finalizes deposit if provider confirmed.
   */
  async getStatus(req, res) {
    try {
      const result = await PaymentService.checkDepositStatus({
        transactionId: req.params.transactionId,
        userId:        req.user.id,
      });

      if (!result) return res.status(404).json({ error: 'Transaction not found' });

      return res.json({
        transactionId: result.id,
        status:        result.status,
        amount:        result.amount,
        type:          result.type,
        channel:       result.channel,
        balanceAfter:  result.balance_after,
        completedAt:   result.completed_at,
        failureReason: result.failure_reason,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Status check failed' });
    }
  },

  // ── WEBHOOKS ─────────────────────────────────────────────────────
  //
  // MTN and Airtel call these URLs when a payment completes.
  // Register these URLs in your MTN/Airtel developer portal:
  //   MTN deposit webhook:    POST /api/webhooks/mtn/deposit
  //   MTN withdrawal webhook: POST /api/webhooks/mtn/withdrawal
  //   Airtel webhook:         POST /api/webhooks/airtel

  /**
   * POST /api/webhooks/mtn/deposit
   * MTN calls this when a requestToPay completes or fails.
   */
  async webhookMtnDeposit(req, res) {
    // Always respond 200 quickly — MTN retries if we're slow
    res.sendStatus(200);

    try {
      const body = req.body;
      logger.info('MTN deposit webhook received', { body });

      const referenceId = body.referenceId || body.financialTransactionId;
      if (!referenceId) return;

      const tx = await TransactionModel.findByProviderId(referenceId);
      if (!tx) {
        logger.warn('MTN webhook: no matching transaction', { referenceId });
        return;
      }

      if (body.status === 'SUCCESSFUL' && tx.status !== 'completed') {
        await PaymentService.finalizeDeposit(tx);
        logger.info('MTN webhook: deposit finalized', { txId: tx.id });
      } else if (body.status === 'FAILED') {
        await TransactionModel.updateStatus(tx.id, 'failed', {
          failureReason: body.reason || 'MTN declined',
          providerResponse: body,
        });
        logger.info('MTN webhook: deposit failed', { txId: tx.id });
      }
    } catch (err) {
      logger.error('MTN deposit webhook error', { error: err.message });
    }
  },

  /**
   * POST /api/webhooks/mtn/withdrawal
   * MTN calls this when a transfer completes or fails.
   */
  async webhookMtnWithdrawal(req, res) {
    res.sendStatus(200);

    try {
      const body = req.body;
      logger.info('MTN withdrawal webhook received', { body });

      const referenceId = body.referenceId || body.financialTransactionId;
      if (!referenceId) return;

      const tx = await TransactionModel.findByProviderId(referenceId);
      if (!tx) return;

      await TransactionModel.updateStatus(tx.id,
        body.status === 'SUCCESSFUL' ? 'completed' : 'failed',
        {
          providerResponse: body,
          failureReason: body.status !== 'SUCCESSFUL' ? (body.reason || 'MTN transfer failed') : null,
        }
      );

      // If MTN says transfer failed but we already debited, reverse it
      if (body.status === 'FAILED' && tx.status === 'processing') {
        const account = await UserModel.getAccount(tx.user_id);
        await TransactionModel.credit({
          accountId:   account.id,
          userId:      tx.user_id,
          type:        'reversal',
          channel:     'internal',
          amount:      tx.amount + tx.fee,
          description: `Auto-reversal: MTN transfer failed (${tx.id})`,
        });
        logger.warn('MTN withdrawal failed — balance reversed', { txId: tx.id });
      }
    } catch (err) {
      logger.error('MTN withdrawal webhook error', { error: err.message });
    }
  },

  /**
   * POST /api/webhooks/airtel
   * Airtel calls this for both collections and disbursements.
   */
  async webhookAirtel(req, res) {
    res.sendStatus(200);

    try {
      const body = req.body;
      logger.info('Airtel webhook received', { body });

      const referenceId = body.transaction?.id || body.id;
      if (!referenceId) return;

      const tx = await TransactionModel.findByProviderId(referenceId);
      if (!tx) return;

      // Airtel uses TS=success, TF=failed
      const statusMap = { TS: 'SUCCESSFUL', TF: 'FAILED', TP: 'PENDING' };
      const providerStatus = statusMap[body.transaction?.status] || 'PENDING';

      if (providerStatus === 'SUCCESSFUL') {
        if (tx.type === 'deposit' && tx.status !== 'completed') {
          await PaymentService.finalizeDeposit(tx);
        } else {
          await TransactionModel.updateStatus(tx.id, 'completed', { providerResponse: body });
        }
      } else if (providerStatus === 'FAILED') {
        await TransactionModel.updateStatus(tx.id, 'failed', {
          providerResponse: body,
          failureReason: body.transaction?.message || 'Airtel declined',
        });

        // Reverse withdrawal if needed
        if (tx.type === 'withdrawal' && tx.status === 'processing') {
          const account = await UserModel.getAccount(tx.user_id);
          await TransactionModel.credit({
            accountId:   account.id,
            userId:      tx.user_id,
            type:        'reversal',
            channel:     'internal',
            amount:      tx.amount + tx.fee,
            description: `Auto-reversal: Airtel transfer failed (${tx.id})`,
          });
        }
      }
    } catch (err) {
      logger.error('Airtel webhook error', { error: err.message });
    }
  },
};

module.exports = PaymentController;