/**
 * Taljoe Fintech — Account Routes
 * server/routes/account.routes.js
 *
 * All routes require authentication.
 */

'use strict';

const router = require('express').Router();
const AccountController = require('../controllers/account.controller');
const { authenticate }  = require('../middleware/auth.middleware');

// All account routes are protected
router.use(authenticate);

router.get('/balance',                AccountController.getBalance);
router.get('/transactions',           AccountController.getTransactions);
router.get('/transactions/:id',       AccountController.getTransaction);
router.get('/statement',              AccountController.getStatement);
router.post('/kyc',                   AccountController.submitKyc);
router.get('/lookup/:accountNumber',  AccountController.lookupAccount);

module.exports = router;