/**
 * Taljoe Fintech — Auth Controller
 * server/controllers/auth.controller.js
 *
 * Handles: register, login, refresh token, logout, set PIN
 */

'use strict';

const { body, validationResult } = require('express-validator');
const UserModel  = require('../models/user.model');
const AuditModel = require('../models/audit.model');
const { generateTokens, rotateRefreshToken } = require('../middleware/auth.middleware');
const { query }  = require('../config/database');
const crypto     = require('crypto');
const logger     = require('../utils/logger');

// ── Validation rules ──────────────────────────────────────────────

const registerRules = [
  body('phone')
    .trim()
    .matches(/^(\+?256|0)[0-9]{9}$/)
    .withMessage('Enter a valid Uganda phone number (e.g. 0771234567)'),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2–100 characters'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Enter a valid email address'),
];

const loginRules = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const setPinRules = [
  body('pin')
    .matches(/^\d{4}$/)
    .withMessage('PIN must be exactly 4 digits'),
  body('confirmPin')
    .custom((val, { req }) => val === req.body.pin)
    .withMessage('PINs do not match'),
];

// ── Helper ────────────────────────────────────────────────────────

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
};

const ipOf  = (req) => req.ip || req.connection.remoteAddress;
const uaOf  = (req) => req.headers['user-agent'];

// ── Controller ────────────────────────────────────────────────────

const AuthController = {

  registerRules,
  loginRules,
  setPinRules,

  /**
   * POST /api/auth/register
   * Create a new user account.
   */
  async register(req, res) {
    if (!validate(req, res)) return;

    const { phone, fullName, password, email } = req.body;

    try {
      // Check phone not already registered
      const existing = await UserModel.findByPhone(phone);
      if (existing) {
        return res.status(409).json({ error: 'An account with this phone number already exists' });
      }

      const user = await UserModel.create({ phone, fullName, password, email });

      const { accessToken, refreshToken } = await generateTokens(
        { id: user.id, phone_hash: user.phone_hash },
        ipOf(req), uaOf(req)
      );

      await AuditModel.log({
        userId:    user.id,
        eventType: 'user_registered',
        eventData: { phone: phone.slice(0, 6) + '****' },
        ipAddress: ipOf(req),
        userAgent: uaOf(req),
      });

      logger.info('New user registered', { userId: user.id });

      return res.status(201).json({
        message: 'Account created successfully',
        user: {
          id:            user.id,
          fullName:      user.full_name,
          email:         user.email,
          status:        user.status,
          kycStatus:     user.kyc_status,
          account: {
            id:            user.account.id,
            accountNumber: user.account.account_number,
            balance:       user.account.balance,
          },
        },
        tokens: { accessToken, refreshToken },
      });
    } catch (err) {
      logger.error('Registration error', { error: err.message });
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  },

  /**
   * POST /api/auth/login
   * Authenticate user, return token pair.
   */
  async login(req, res) {
    if (!validate(req, res)) return;

    const { phone, password } = req.body;

    try {
      const user = await UserModel.findByPhone(phone);

      if (!user) {
        // Don't reveal whether phone exists
        return res.status(401).json({ error: 'Invalid phone number or password' });
      }

      // Check lockout
      const locked = await UserModel.isLocked(user.id);
      if (locked) {
        return res.status(423).json({
          error:   'Account temporarily locked due to too many failed attempts',
          code:    'ACCOUNT_LOCKED',
          retryAfter: 30, // minutes
        });
      }

      const valid = await UserModel.verifyPassword(user, password);
      if (!valid) {
        const { failed_login_count } = await UserModel.recordFailedLogin(user.id);
        await AuditModel.log({
          userId:    user.id,
          eventType: 'login_failed',
          eventData: { attempts: failed_login_count },
          ipAddress: ipOf(req),
        });
        return res.status(401).json({
          error:    'Invalid phone number or password',
          attempts: failed_login_count,
          lockAfter: 5,
        });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended. Contact support.' });
      }

      await UserModel.recordSuccessfulLogin(user.id);

      const { accessToken, refreshToken } = await generateTokens(user, ipOf(req), uaOf(req));

      await AuditModel.log({
        userId:    user.id,
        eventType: 'login_success',
        ipAddress: ipOf(req),
        userAgent: uaOf(req),
      });

      const fullUser = await UserModel.findById(user.id);

      return res.json({
        message: 'Login successful',
        user: {
          id:        fullUser.id,
          fullName:  fullUser.full_name,
          email:     fullUser.email,
          phone:     fullUser.phone,
          status:    fullUser.status,
          kycStatus: fullUser.kyc_status,
          account: {
            accountNumber: fullUser.account_number,
            balance:       fullUser.balance,
            isFrozen:      fullUser.is_frozen,
          },
        },
        tokens: { accessToken, refreshToken },
      });
    } catch (err) {
      logger.error('Login error', { error: err.message });
      return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  },

  /**
   * POST /api/auth/refresh
   * Exchange a refresh token for a new access + refresh token pair.
   */
  async refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
      const tokens = await rotateRefreshToken(refreshToken, ipOf(req), uaOf(req));
      return res.json({ tokens });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  },

  /**
   * POST /api/auth/logout
   * Revoke the refresh token.
   */
  async logout(req, res) {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]);
    }
    await AuditModel.log({
      userId:    req.user?.id,
      eventType: 'logout',
      ipAddress: ipOf(req),
    });
    return res.json({ message: 'Logged out successfully' });
  },

  /**
   * POST /api/auth/set-pin
   * Set or change the 4-digit transaction PIN.
   * Requires authentication.
   */
  async setPin(req, res) {
    if (!validate(req, res)) return;
    try {
      await UserModel.setPin(req.user.id, req.body.pin);
      await AuditModel.log({
        userId:    req.user.id,
        eventType: 'pin_changed',
        ipAddress: ipOf(req),
      });
      return res.json({ message: 'Transaction PIN set successfully' });
    } catch (err) {
      logger.error('Set PIN error', { error: err.message });
      return res.status(500).json({ error: 'Failed to set PIN' });
    }
  },

  /**
   * GET /api/auth/me
   * Return the authenticated user's profile.
   */
  async me(req, res) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({
        id:        user.id,
        fullName:  user.full_name,
        email:     user.email,
        phone:     user.phone,
        status:    user.status,
        kycStatus: user.kyc_status,
        account: {
          accountNumber: user.account_number,
          balance:       user.balance,
          isFrozen:      user.is_frozen,
        },
        lastLoginAt: user.last_login_at,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
  },
};

module.exports = AuthController;