/**
 * Taljoe Fintech — Auth Middleware
 * src/middleware/auth.middleware.js
 */

'use strict';

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { query }  = require('../config/database');
const logger = require('../utils/logger');

/**
 * Verify JWT access token and attach user to request.
 */
const authenticate = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, phone: payload.phone };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Generate access + refresh token pair.
 */
const generateTokens = async (user, ipAddress, userAgent) => {
  const accessToken = jwt.sign(
    { sub: user.id, phone: user.phone_hash },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );

  const refreshToken = require('crypto').randomBytes(64).toString('hex');
  const tokenHash    = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await query(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
    VALUES ($1, $2, $3, $4::inet, $5)
  `, [user.id, tokenHash, expiresAt, ipAddress, userAgent]);

  return { accessToken, refreshToken };
};

/**
 * Validate and rotate a refresh token.
 */
const rotateRefreshToken = async (refreshToken, ipAddress, userAgent) => {
  const tokenHash = require('crypto').createHash('sha256').update(refreshToken).digest('hex');

  const { rows } = await query(`
    SELECT rt.*, u.id as user_id
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token_hash = $1
      AND rt.revoked = false
      AND rt.expires_at > NOW()
  `, [tokenHash]);

  if (!rows.length) throw new Error('Invalid or expired refresh token');

  const stored = rows[0];

  // Revoke old token (rotation)
  await query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [stored.id]);

  const { rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [stored.user_id]);

  return generateTokens(user, ipAddress, userAgent);
};

module.exports = { authenticate, generateTokens, rotateRefreshToken };