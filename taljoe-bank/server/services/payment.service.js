/**
 * Taljoe Fintech — Payment Service
 * src/services/payment.service.js
 *
 * Orchestrates deposits and withdrawals:
 *   1. Routes to correct provider (MTN / Airtel) by phone prefix
 *   2. Creates a pending transaction record
 *   3. Initiates payment with provider
 *   4. Polls or waits for webhook to finalize
 *
 * Uganda phone prefixes:
 *   MTN:   +25677x, +25678x
 *   Airtel: +25670x, +25675x
 */

'use strict';

const MtnMomoService  = require('./mtn-momo.service');
const AirtelService   = require('./airtel.service');
const TransactionModel = require('../models/transaction.model');
const UserModel        = require('../models/user.model');
const AuditModel       = require('../models/audit.model');
const logger           = require('../utils/logger');
const { withTransaction } = require('../config/database');

// ── Provider Detection ────────────────────────────────────────────

const MTN_PREFIXES    = ['2567', '25677', '25678'];
const AIRTEL_PREFIXES = ['25670', '25675'];

/**
 * Detect payment provider from phone number.
 * @param {string} phone - e.g. "256771234567" or "0771234567"
 * @returns {'mtn' | 'airtel' | null}
 */
const detectProvider = (phone) => {
  // Normalize to international format
  let normalized = phone.replace(/\s+/g, '');
  if (normalized.startsWith('0')) normalized = '256' + normalized.slice(1);
  if (normalized.startsWith('+')) normalized = normalized.slice(1);

  if (normalized.startsWith('25677') || normalized.startsWith('25678')) return 'mtn';
  if (normalized.startsWith('25670') || normalized.startsWith('25675')) return 'airtel';
  return null;
};

/**
 * Normalize phone to international format (256XXXXXXXXX).
 */
const normalizePhone = (phone) => {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = '256' + p.slice(1);
  return p;
};

// ── Fee Calculation ───────────────────────────────────────────────

/**
 * Calculate transaction fee (UGX).
 * Adjust these tiers to match your partner agreement.
 */
const calculateFee = (amount, type, channel) => {
  if (type === 'deposit') return 0; // Free deposits to attract users
  if (type === 'withdrawal') {
    if (amount <= 2500)   return 250;
    if (amount <= 5000)   return 375;
    if (amount <= 15000)  return 450;
    if (amount <= 45000)  return 600;
    if (amount <= 100000) return 900;
    if (amount <= 200000) return 1500;
    if (amount <= 350000) return 2250;
    if (amount <= 500000) return 3000;
    return Math.round(amount * 0.01); // 1% above 500k
  }
  return 0;
};

// ── Payment Service ───────────────────────────────────────────────

const PaymentService = {

  /**
   * Initiate a deposit from a mobile money wallet.
   *
   * @param {object} opts
   * @param {string}  opts.userId     - Authenticated user's ID
   * @param {string}  opts.phone      - MoMo phone number to charge
   * @param {number}  opts.amount     - UGX amount
   * @param {string}  [opts.note]
   * @param {string}  [opts.ipAddress]
   * @returns {Promise<{transactionId, providerRef, message}>}
   */
  async initiateDeposit({ userId, phone, amount, note, ipAddress }) {
    const MIN = parseInt(process.env.MIN_DEPOSIT_AMOUNT || '500');
    const MAX = parseInt(process.env.MAX_TRANSACTION_AMOUNT || '5000000');

    if (amount < MIN) throw Object.assign(new Error(`Minimum deposit is UGX ${MIN.toLocaleString()}`), { code: 'AMOUNT_TOO_SMALL' });
    if (amount > MAX) throw Object.assign(new Error(`Maximum deposit is UGX ${MAX.toLocaleString()}`), { code: 'AMOUNT_TOO_LARGE' });

    const normalized = normalizePhone(phone);
    const provider   = detectProvider(normalized);
    if (!provider) throw Object.assign(new Error('Phone number not recognized as MTN or Airtel'), { code: 'UNKNOWN_PROVIDER' });

    const account = await UserModel.getAccount(userId);
    if (!account) throw new Error('Account not found');

    // Create pending transaction first (before calling provider)
    const tx = await TransactionModel.createPending({
      accountId: account.id,
      userId,
      type:      'deposit',
      channel:   provider === 'mtn' ? 'mtn_momo' : 'airtel_money',
      amount,
      fee:       0,
      description: note || `MoMo deposit via ${provider.toUpperCase()}`,
      ipAddress,
    });

    logger.info('PaymentService: initiating deposit', { userId, provider, amount, txId: tx.id });

    try {
      let providerRef;

      if (provider === 'mtn') {
        const result = await MtnMomoService.requestToPay({
          phone:      normalized,
          amount,
          externalId: tx.id,
          payerNote:  note || 'Taljoe Bank deposit',
        });
        providerRef = result.referenceId;
      } else {
        const result = await AirtelService.collect({
          phone:      normalized,
          amount,
          externalId: tx.id,
        });
        providerRef = result.referenceId;
      }

      // Update pending tx with provider reference
      await TransactionModel.updateStatus(tx.id, 'processing', { providerTxId: providerRef });

      await AuditModel.log({
        userId,
        eventType: 'deposit_initiated',
        eventData: { txId: tx.id, provider, amount, providerRef },
        ipAddress,
      });

      return {
        transactionId: tx.id,
        providerRef,
        message: `Check your ${provider === 'mtn' ? 'MTN' : 'Airtel'} phone to approve the payment`,
        status: 'pending',
      };
    } catch (err) {
      // Mark transaction as failed
      await TransactionModel.updateStatus(tx.id, 'failed', { failureReason: err.message });
      logger.error('PaymentService: deposit initiation failed', { txId: tx.id, error: err.message });
      throw err;
    }
  },

  /**
   * Poll deposit status (client can call this after initiation).
   * In production, prefer webhooks — only poll as fallback.
   */
  async checkDepositStatus({ transactionId, userId }) {
    const tx = await TransactionModel.findById(transactionId, userId);
    if (!tx) throw new Error('Transaction not found');
    if (tx.status === 'completed' || tx.status === 'failed') return tx;

    let providerStatus;
    try {
      if (tx.channel === 'mtn_momo') {
        const res = await MtnMomoService.getRequestToPayStatus(tx.provider_tx_id);
        providerStatus = res.status;
      } else {
        const res = await AirtelService.getCollectionStatus(tx.provider_tx_id);
        providerStatus = res.status;
      }
    } catch (err) {
      logger.warn('PaymentService: provider status check failed', { txId: transactionId, error: err.message });
      return tx; // Return current state
    }

    if (providerStatus === 'SUCCESSFUL') {
      return this.finalizeDeposit(tx);
    }
    if (providerStatus === 'FAILED') {
      await TransactionModel.updateStatus(tx.id, 'failed', { failureReason: 'Provider declined' });
      return TransactionModel.findById(tx.id, userId);
    }

    return tx; // Still pending
  },

  /**
   * Finalize a deposit (credit account).
   * Called from webhook OR poll when provider confirms success.
   */
  async finalizeDeposit(tx) {
    if (tx.status === 'completed') return tx; // idempotent

    const account = await UserModel.getAccount(tx.user_id);

    // This credits the account atomically
    const { transaction } = await TransactionModel.credit({
      accountId:   account.id,
      userId:      tx.user_id,
      type:        'deposit',
      channel:     tx.channel,
      amount:      tx.amount,
      fee:         0,
      description: tx.description,
      providerTxId: tx.provider_tx_id,
    });

    // Mark original pending as completed
    await TransactionModel.updateStatus(tx.id, 'completed');

    logger.info('PaymentService: deposit completed', { txId: tx.id, amount: tx.amount, userId: tx.user_id });

    return transaction;
  },

  /**
   * Initiate a withdrawal to a mobile money wallet.
   */
  async initiateWithdrawal({ userId, phone, amount, pin, note, ipAddress }) {
    const MAX = parseInt(process.env.MAX_TRANSACTION_AMOUNT || '5000000');
    if (amount < 500)  throw Object.assign(new Error('Minimum withdrawal is UGX 500'), { code: 'AMOUNT_TOO_SMALL' });
    if (amount > MAX)  throw Object.assign(new Error(`Maximum withdrawal is UGX ${MAX.toLocaleString()}`), { code: 'AMOUNT_TOO_LARGE' });

    // Verify transaction PIN
    const pinValid = await UserModel.verifyPin(userId, pin);
    if (!pinValid) throw Object.assign(new Error('Invalid transaction PIN'), { code: 'INVALID_PIN', status: 401 });

    const normalized = normalizePhone(phone);
    const provider   = detectProvider(normalized);
    if (!provider) throw Object.assign(new Error('Phone number not recognized as MTN or Airtel'), { code: 'UNKNOWN_PROVIDER' });

    const account = await UserModel.getAccount(userId);
    if (!account) throw new Error('Account not found');

    const fee       = calculateFee(amount, 'withdrawal', provider);
    const totalCost = amount + fee;

    // Debit atomically (throws if insufficient balance / daily limit exceeded)
    const { transaction: tx, newBalance } = await TransactionModel.debit({
      accountId:   account.id,
      userId,
      type:        'withdrawal',
      channel:     provider === 'mtn' ? 'mtn_momo' : 'airtel_money',
      amount,
      fee,
      description: note || `MoMo withdrawal via ${provider.toUpperCase()}`,
      counterpartPhone: normalized,
      ipAddress,
    });

    logger.info('PaymentService: initiating withdrawal', { userId, provider, amount, fee, txId: tx.id });

    try {
      let providerRef;

      if (provider === 'mtn') {
        const result = await MtnMomoService.transfer({
          phone:      normalized,
          amount,
          externalId: tx.id,
          note:       note || 'Taljoe Bank withdrawal',
        });
        providerRef = result.referenceId;
      } else {
        const result = await AirtelService.disburse({
          phone:      normalized,
          amount,
          externalId: tx.id,
        });
        providerRef = result.referenceId;
      }

      await TransactionModel.updateStatus(tx.id, 'processing', { providerTxId: providerRef });

      await AuditModel.log({
        userId,
        eventType: 'withdrawal_initiated',
        eventData: { txId: tx.id, provider, amount, fee, providerRef },
        ipAddress,
      });

      return {
        transactionId: tx.id,
        providerRef,
        fee,
        newBalance,
        message: `UGX ${amount.toLocaleString()} is being sent to your ${provider === 'mtn' ? 'MTN' : 'Airtel'} wallet`,
        status: 'processing',
      };
    } catch (err) {
      // Reverse the debit since provider call failed
      await withTransaction(async (client) => {
        await TransactionModel.credit({
          accountId:   account.id,
          userId,
          type:        'reversal',
          channel:     'internal',
          amount:      totalCost,
          description: `Reversal of failed withdrawal: ${tx.id}`,
        }, client);
        await TransactionModel.updateStatus(tx.id, 'failed', { failureReason: err.message });
      });

      logger.error('PaymentService: withdrawal failed, reversed', { txId: tx.id, error: err.message });
      throw Object.assign(new Error('Withdrawal failed — your balance has been restored'), { code: 'PROVIDER_ERROR' });
    }
  },

  /**
   * Internal transfer between two Taljoe Bank accounts.
   */
  async internalTransfer({ fromUserId, toAccountNumber, amount, pin, note, ipAddress }) {
    if (amount < 100) throw new Error('Minimum transfer is UGX 100');

    const pinValid = await UserModel.verifyPin(fromUserId, pin);
    if (!pinValid) throw Object.assign(new Error('Invalid transaction PIN'), { code: 'INVALID_PIN', status: 401 });

    const fromAccount = await UserModel.getAccount(fromUserId);
    const toAccount   = await UserModel.getAccountByNumber(toAccountNumber);
    if (!toAccount) throw Object.assign(new Error('Destination account not found'), { code: 'ACCOUNT_NOT_FOUND' });
    if (fromAccount.id === toAccount.id) throw new Error('Cannot transfer to your own account');

    return withTransaction(async (client) => {
      // Debit sender
      const { transaction: debitTx } = await TransactionModel.debit({
        accountId:        fromAccount.id,
        userId:           fromUserId,
        type:             'transfer_out',
        channel:          'internal',
        amount,
        fee:              0,
        description:      note || `Transfer to ${toAccountNumber}`,
        counterpartAccount: toAccountNumber,
        counterpartName:  toAccount.full_name,
        ipAddress,
      }, client);

      // Credit receiver
      const { transaction: creditTx, newBalance: receiverBalance } = await TransactionModel.credit({
        accountId:        toAccount.id,
        userId:           toAccount.user_id,
        type:             'transfer_in',
        channel:          'internal',
        amount,
        fee:              0,
        description:      note || `Transfer from ${fromAccount.account_number}`,
        counterpartAccount: fromAccount.account_number,
        counterpartName:  fromAccount.full_name,
        ipAddress,
      }, client);

      logger.info('PaymentService: internal transfer completed', {
        from: fromAccount.account_number,
        to: toAccountNumber,
        amount,
      });

      return {
        transactionId: debitTx.id,
        amount,
        recipient: { accountNumber: toAccountNumber, name: toAccount.full_name },
        newBalance: debitTx.balance_after,
      };
    });
  },
};

module.exports = PaymentService;