/**
 * Taljoe Fintech — User Model
 * src/models/user.model.js
 *
 * All database interactions for users and accounts.
 * Business logic lives in controllers/services, not here.
 */

'use strict';

const bcrypt     = require('bcryptjs');
const { query, withTransaction } = require('../config/database');
const { encrypt, decrypt, hash } = require('../utils/encryption');
const logger     = require('../utils/logger');

const BCRYPT_ROUNDS = 12;

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Generate a unique account number like TJ-0001234
 */
const generateAccountNumber = async () => {
  const result = await query("SELECT nextval('account_number_seq') AS n");
  const n = String(result.rows[0].n).padStart(7, '0');
  return `TJ-${n}`;
};

// ── User CRUD ────────────────────────────────────────────────────

const UserModel = {

  /**
   * Create a new user and their account in a single transaction.
   */
  async create({ phone, email, fullName, password }) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const phoneHash    = hash(phone);
    const phoneEnc     = encrypt(phone);
    const accountNumber = await generateAccountNumber();

    return withTransaction(async (client) => {
      // Create user
      const { rows: [user] } = await client.query(`
        INSERT INTO users (phone_hash, phone_encrypted, email, full_name, password_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, full_name, email, status, kyc_status, created_at
      `, [phoneHash, phoneEnc, email || null, fullName, passwordHash]);

      // Create account
      const { rows: [account] } = await client.query(`
        INSERT INTO accounts (user_id, account_number)
        VALUES ($1, $2)
        RETURNING id, account_number, balance
      `, [user.id, accountNumber]);

      return { ...user, account };
    });
  },

  /**
   * Find user by phone number (decrypts and returns safe fields).
   */
  async findByPhone(phone) {
    const phoneHash = hash(phone);
    const { rows } = await query(
      'SELECT * FROM users WHERE phone_hash = $1 LIMIT 1',
      [phoneHash]
    );
    if (!rows.length) return null;
    const user = rows[0];
    user.phone = decrypt(user.phone_encrypted); // decrypt for use
    return user;
  },

  /**
   * Find user by ID (safe public fields only).
   */
  async findById(userId) {
    const { rows } = await query(`
      SELECT u.id, u.full_name, u.email, u.status, u.kyc_status,
             u.last_login_at, u.created_at,
             a.id AS account_id, a.account_number, a.balance, a.is_frozen,
             decrypt(u.phone_encrypted::bytea, $2, 'aes') as phone
      FROM users u
      JOIN accounts a ON a.user_id = u.id
      WHERE u.id = $1
    `, [userId, process.env.ENCRYPTION_KEY]);

    // Use our JS decryption instead of pg's
    const { rows: raw } = await query(`
      SELECT u.id, u.full_name, u.email, u.status, u.kyc_status,
             u.phone_encrypted, u.last_login_at, u.created_at, u.failed_login_count,
             a.id AS account_id, a.account_number, a.balance, a.is_frozen, a.daily_spent
      FROM users u
      JOIN accounts a ON a.user_id = u.id
      WHERE u.id = $1
    `, [userId]);

    if (!raw.length) return null;
    const user = raw[0];
    user.phone = decrypt(user.phone_encrypted);
    delete user.phone_encrypted;
    return user;
  },

  /**
   * Verify password for login.
   */
  async verifyPassword(user, password) {
    return bcrypt.compare(password, user.password_hash);
  },

  /**
   * Verify transaction PIN.
   */
  async verifyPin(userId, pin) {
    const { rows } = await query('SELECT pin_hash FROM users WHERE id = $1', [userId]);
    if (!rows.length || !rows[0].pin_hash) return false;
    return bcrypt.compare(String(pin), rows[0].pin_hash);
  },

  /**
   * Set or update transaction PIN.
   */
  async setPin(userId, pin) {
    const pinHash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);
    await query('UPDATE users SET pin_hash = $1 WHERE id = $2', [pinHash, userId]);
  },

  /**
   * Record a failed login attempt, lock account if threshold exceeded.
   */
  async recordFailedLogin(userId) {
    const { rows: [u] } = await query(`
      UPDATE users
      SET failed_login_count = failed_login_count + 1,
          locked_until = CASE
            WHEN failed_login_count + 1 >= 5
            THEN NOW() + INTERVAL '30 minutes'
            ELSE locked_until
          END
      WHERE id = $1
      RETURNING failed_login_count, locked_until
    `, [userId]);
    return u;
  },

  /**
   * Reset failed login count on successful login.
   */
  async recordSuccessfulLogin(userId) {
    await query(`
      UPDATE users
      SET failed_login_count = 0,
          locked_until       = NULL,
          last_login_at      = NOW()
      WHERE id = $1
    `, [userId]);
  },

  /**
   * Check if account is locked out.
   */
  async isLocked(userId) {
    const { rows } = await query(
      'SELECT locked_until FROM users WHERE id = $1',
      [userId]
    );
    if (!rows.length) return false;
    const { locked_until } = rows[0];
    return locked_until && new Date(locked_until) > new Date();
  },

  /**
   * Update KYC status (called by admin or automated check).
   */
  async updateKycStatus(userId, kycStatus, userStatus) {
    await query(`
      UPDATE users
      SET kyc_status = $2, status = $3
      WHERE id = $1
    `, [userId, kycStatus, userStatus || 'active']);
  },

  /**
   * Get account by user ID.
   */
  async getAccount(userId) {
    const { rows } = await query(
      'SELECT * FROM accounts WHERE user_id = $1',
      [userId]
    );
    return rows[0] || null;
  },

  /**
   * Get account by account number.
   */
  async getAccountByNumber(accountNumber) {
    const { rows } = await query(`
      SELECT a.*, u.full_name
      FROM accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.account_number = $1
    `, [accountNumber]);
    return rows[0] || null;
  },
};

module.exports = UserModel;