/**
 * Taljoe Fintech — Webhook Routes
 * server/routes/webhook.routes.js
 *
 * These endpoints are called by MTN and Airtel servers.
 * They are PUBLIC (no auth token) but should be verified
 * by IP allowlist in your nginx/firewall in production.
 *
 * MTN IP ranges:  https://momodeveloper.mtn.com/faq
 * Airtel IPs:     provided in your Airtel developer portal
 */

'use strict';

const router            = require('express').Router();
const PaymentController = require('../controllers/payment.controller');

router.post('/mtn/deposit',    PaymentController.webhookMtnDeposit);
router.post('/mtn/withdrawal', PaymentController.webhookMtnWithdrawal);
router.post('/airtel',         PaymentController.webhookAirtel);

module.exports = router;