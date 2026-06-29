/**
 * Taljoe Fintech — Payment Routes
 * server/routes/payment.routes.js
 *
 * /api/payments/* — require authentication
 * /api/webhooks/* — public (called by MTN/Airtel servers)
 */

'use strict';

const router           = require('express').Router();
const PaymentController = require('../controllers/payment.controller');
const { authenticate }  = require('../middleware/auth.middleware');

// ── Authenticated payment actions ─────────────────────────────────
router.post('/deposit',      authenticate, PaymentController.depositRules, PaymentController.deposit);
router.post('/withdraw',     authenticate, PaymentController.withdrawRules, PaymentController.withdraw);
router.post('/transfer',     authenticate, PaymentController.transferRules, PaymentController.transfer);
router.get ('/status/:transactionId', authenticate, PaymentController.getStatus);

module.exports = router;