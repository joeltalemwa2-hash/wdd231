/**
 * Taljoe Fintech — Airtel Money Service
 * src/services/airtel.service.js
 *
 * Integrates with Airtel Africa Open API (Uganda).
 * Docs: https://developers.airtel.africa/documentation
 *
 * Handles:
 *   - Collections (customer pays us)
 *   - Disbursements (we pay customer)
 */

'use strict';

const axios  = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const BASE_URL = process.env.AIRTEL_BASE_URL || 'https://openapiuat.airtel.africa';

let _airtelToken = null;

const getToken = async () => {
  if (_airtelToken && _airtelToken.expiresAt > Date.now() + 60000) {
    return _airtelToken.token;
  }

  const { data } = await axios.post(
    `${BASE_URL}/auth/oauth2/token`,
    {
      client_id:     process.env.AIRTEL_CLIENT_ID,
      client_secret: process.env.AIRTEL_CLIENT_SECRET,
      grant_type:    'client_credentials',
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  _airtelToken = {
    token:     data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return _airtelToken.token;
};

const AirtelService = {

  /**
   * Request payment from customer (Collection).
   * Sends an Airtel Money USSD prompt.
   *
   * @param {object} opts
   * @param {string} opts.phone      - e.g. "256752123456"
   * @param {number} opts.amount     - UGX
   * @param {string} opts.externalId - Our transaction ID
   * @returns {Promise<{referenceId: string}>}
   */
  async collect({ phone, amount, externalId }) {
    const token       = await getToken();
    const referenceId = uuidv4();

    logger.info('Airtel: collect', { phone, amount, referenceId });

    const { data } = await axios.post(
      `${BASE_URL}/merchant/v1/payments/`,
      {
        reference:   externalId,
        subscriber:  { country: 'UG', currency: 'UGX', msisdn: phone.replace(/^\+/, '') },
        transaction: { amount: String(amount), country: 'UG', currency: 'UGX', id: referenceId },
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
          'X-Country':     'UG',
          'X-Currency':    'UGX',
        },
      }
    );

    return { referenceId, raw: data };
  },

  /**
   * Check collection status.
   */
  async getCollectionStatus(referenceId) {
    const token = await getToken();

    const { data } = await axios.get(
      `${BASE_URL}/standard/v1/payments/${referenceId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Country':     'UG',
          'X-Currency':    'UGX',
        },
      }
    );

    // Airtel statuses: TS (success), TF (failed), TP (pending)
    const statusMap = { TS: 'SUCCESSFUL', TF: 'FAILED', TP: 'PENDING' };
    const status = statusMap[data.data?.transaction?.status] || 'PENDING';

    return { status, raw: data };
  },

  /**
   * Disburse money to customer's Airtel wallet.
   */
  async disburse({ phone, amount, externalId, note }) {
    const token       = await getToken();
    const referenceId = uuidv4();

    logger.info('Airtel: disburse', { phone, amount, referenceId });

    const { data } = await axios.post(
      `${BASE_URL}/standard/v1/disbursements/`,
      {
        payee:       { msisdn: phone.replace(/^\+/, ''), wallet_type: 'NORMAL' },
        reference:   externalId,
        pin:         process.env.AIRTEL_DISBURSEMENT_PIN,
        transaction: { amount: String(amount), id: referenceId, type: 'B2C' },
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
          'X-Country':     'UG',
          'X-Currency':    'UGX',
        },
      }
    );

    return { referenceId, raw: data };
  },

  /**
   * Check disbursement status.
   */
  async getDisbursementStatus(referenceId) {
    const token = await getToken();

    const { data } = await axios.get(
      `${BASE_URL}/standard/v1/disbursements/${referenceId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Country':     'UG',
          'X-Currency':    'UGX',
        },
      }
    );

    const statusMap = { TS: 'SUCCESSFUL', TF: 'FAILED', TP: 'PENDING' };
    const status = statusMap[data.data?.transaction?.status] || 'PENDING';

    return { status, raw: data };
  },
};

module.exports = AirtelService;