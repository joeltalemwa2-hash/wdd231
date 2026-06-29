/**
 * Taljoe Fintech — MTN Mobile Money Service
 * src/services/mtn-momo.service.js
 *
 * Integrates with MTN MoMo Uganda API.
 *
 * MTN MoMo has two products relevant to us:
 *   - Collections API  → user pays us (deposit)
 *   - Disbursements API → we pay user (withdrawal)
 *
 * API Docs: https://momodeveloper.mtn.com/api-documentation/api-description/
 * Sandbox:  https://sandbox.momodeveloper.mtn.com
 *
 * Flow for deposit:
 *   1. Generate API user + key (one-time setup per env)
 *   2. Get OAuth token
 *   3. Request to Pay → MTN sends USSD push to customer
 *   4. Customer approves on their phone
 *   5. MTN calls our webhook OR we poll the status
 *   6. On success: credit customer account
 *
 * Flow for withdrawal:
 *   1. Get OAuth token
 *   2. Transfer → MTN sends money to customer's MoMo wallet
 *   3. Poll / webhook to confirm
 */

'use strict';

const axios  = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const BASE_URL  = process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const ENV       = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';
const CURRENCY  = process.env.MTN_MOMO_CURRENCY || 'UGX';
const CALLBACK  = process.env.MTN_MOMO_CALLBACK_URL;

const COL_KEY   = process.env.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY;
const DIS_KEY   = process.env.MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY;

// Store tokens in memory (replace with Redis in multi-instance deploy)
let _collectionToken = null;
let _disbursementToken = null;

// ── Token Management ─────────────────────────────────────────────

/**
 * Get a valid OAuth token for Collections or Disbursements.
 * Tokens last ~1 hour — this caches them.
 */
const getToken = async (product) => {
  const isCollection = product === 'collection';
  const cached = isCollection ? _collectionToken : _disbursementToken;

  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  const apiUserId  = isCollection
    ? process.env.MTN_MOMO_COLLECTION_USER_ID
    : process.env.MTN_MOMO_DISBURSEMENT_USER_ID;
  const apiKey     = isCollection
    ? process.env.MTN_MOMO_COLLECTION_API_KEY
    : process.env.MTN_MOMO_DISBURSEMENT_API_KEY;
  const subKey     = isCollection ? COL_KEY : DIS_KEY;
  const endpoint   = isCollection ? 'collection' : 'disbursement';

  const credentials = Buffer.from(`${apiUserId}:${apiKey}`).toString('base64');

  const { data } = await axios.post(
    `${BASE_URL}/${endpoint}/token/`,
    {},
    {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': subKey,
      },
    }
  );

  const tokenObj = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  if (isCollection) _collectionToken = tokenObj;
  else              _disbursementToken = tokenObj;

  return tokenObj.token;
};

// ── Collections (Deposit from customer) ─────────────────────────

const MtnMomoService = {

  /**
   * Request To Pay — push USSD prompt to customer's phone.
   * Customer approves → money moves from their wallet to our collection account.
   *
   * @param {object} opts
   * @param {string} opts.phone       - Customer's MTN number (e.g. "256771234567")
   * @param {number} opts.amount      - Amount in UGX
   * @param {string} opts.externalId  - Our transaction ID for idempotency
   * @param {string} opts.payerNote   - Message shown to customer
   * @param {string} opts.payeeNote   - Our internal note
   * @returns {Promise<{referenceId: string}>}
   */
  async requestToPay({ phone, amount, externalId, payerNote, payeeNote }) {
    const token       = await getToken('collection');
    const referenceId = uuidv4(); // MTN's reference for this request

    logger.info('MTN MoMo: requestToPay', { phone, amount, referenceId });

    await axios.post(
      `${BASE_URL}/collection/v1_0/requesttopay`,
      {
        amount:        String(amount),
        currency:      CURRENCY,
        externalId:    externalId,
        payer: {
          partyIdType: 'MSISDN',
          partyId:     phone,
        },
        payerMessage:  payerNote || 'Taljoe Bank deposit',
        payeeNote:     payeeNote || `Deposit ref: ${externalId}`,
      },
      {
        headers: {
          'Authorization':             `Bearer ${token}`,
          'X-Reference-Id':            referenceId,
          'X-Target-Environment':      ENV,
          'Ocp-Apim-Subscription-Key': COL_KEY,
          'Content-Type':              'application/json',
          ...(CALLBACK ? { 'X-Callback-Url': CALLBACK + '/deposit' } : {}),
        },
      }
    );

    return { referenceId };
  },

  /**
   * Check the status of a requestToPay.
   * Poll this until status is SUCCESSFUL or FAILED.
   *
   * @param {string} referenceId
   * @returns {Promise<{status, reason}>}
   *   status: 'PENDING' | 'SUCCESSFUL' | 'FAILED'
   */
  async getRequestToPayStatus(referenceId) {
    const token = await getToken('collection');

    const { data } = await axios.get(
      `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          'Authorization':             `Bearer ${token}`,
          'X-Target-Environment':      ENV,
          'Ocp-Apim-Subscription-Key': COL_KEY,
        },
      }
    );

    logger.info('MTN MoMo: requestToPay status', { referenceId, status: data.status });
    return { status: data.status, reason: data.reason, raw: data };
  },

  // ── Disbursements (Withdrawal to customer) ─────────────────────

  /**
   * Transfer money to a customer's MTN wallet.
   *
   * @param {object} opts
   * @param {string} opts.phone       - Customer's MTN number
   * @param {number} opts.amount      - Amount in UGX
   * @param {string} opts.externalId  - Our transaction ID
   * @param {string} opts.note        - Message to customer
   * @returns {Promise<{referenceId: string}>}
   */
  async transfer({ phone, amount, externalId, note }) {
    const token       = await getToken('disbursement');
    const referenceId = uuidv4();

    logger.info('MTN MoMo: transfer', { phone, amount, referenceId });

    await axios.post(
      `${BASE_URL}/disbursement/v1_0/transfer`,
      {
        amount:        String(amount),
        currency:      CURRENCY,
        externalId:    externalId,
        payee: {
          partyIdType: 'MSISDN',
          partyId:     phone,
        },
        payerMessage:  note || 'Taljoe Bank withdrawal',
        payeeNote:     `Withdrawal ref: ${externalId}`,
      },
      {
        headers: {
          'Authorization':             `Bearer ${token}`,
          'X-Reference-Id':            referenceId,
          'X-Target-Environment':      ENV,
          'Ocp-Apim-Subscription-Key': DIS_KEY,
          'Content-Type':              'application/json',
          ...(CALLBACK ? { 'X-Callback-Url': CALLBACK + '/withdrawal' } : {}),
        },
      }
    );

    return { referenceId };
  },

  /**
   * Check the status of a transfer.
   */
  async getTransferStatus(referenceId) {
    const token = await getToken('disbursement');

    const { data } = await axios.get(
      `${BASE_URL}/disbursement/v1_0/transfer/${referenceId}`,
      {
        headers: {
          'Authorization':             `Bearer ${token}`,
          'X-Target-Environment':      ENV,
          'Ocp-Apim-Subscription-Key': DIS_KEY,
        },
      }
    );

    logger.info('MTN MoMo: transfer status', { referenceId, status: data.status });
    return { status: data.status, reason: data.reason, raw: data };
  },

  /**
   * Validate if a phone number is a valid MTN subscriber.
   * Use before initiating any transaction.
   */
  async validateMsisdn(phone) {
    try {
      const token = await getToken('collection');
      const { data } = await axios.get(
        `${BASE_URL}/collection/v1_0/accountholder/msisdn/${phone}/basicuserinfo`,
        {
          headers: {
            'Authorization':             `Bearer ${token}`,
            'X-Target-Environment':      ENV,
            'Ocp-Apim-Subscription-Key': COL_KEY,
          },
        }
      );
      return { valid: true, name: data.name };
    } catch {
      return { valid: false };
    }
  },

  /**
   * One-time sandbox setup: create API user and key.
   * Run once per environment. Saves to env vars.
   * See: https://momodeveloper.mtn.com/api-documentation/api-description/#create-api-user
   */
  async sandboxSetup(subscriptionKey) {
    const userId = uuidv4();

    // Create API user
    await axios.post(
      `${BASE_URL}/v1_0/apiuser`,
      { providerCallbackHost: CALLBACK || 'https://localhost' },
      {
        headers: {
          'X-Reference-Id':            userId,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type':              'application/json',
        },
      }
    );

    // Create API key
    const { data } = await axios.post(
      `${BASE_URL}/v1_0/apiuser/${userId}/apikey`,
      {},
      { headers: { 'Ocp-Apim-Subscription-Key': subscriptionKey } }
    );

    return { userId, apiKey: data.apiKey };
  },
};

module.exports = MtnMomoService;