/**
 * Taljoe Fintech — Encryption Utility
 * src/utils/encryption.js
 *
 * AES-256-GCM encryption for sensitive fields stored in the DB
 * (phone numbers, national IDs, etc.).
 *
 * Key comes from ENCRYPTION_KEY env var (32 bytes hex = 64 hex chars).
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 16;  // bytes
const TAG_LENGTH = 16;  // bytes

const getKey = () => {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
};

/**
 * Encrypt a string value.
 * Returns a colon-separated string: iv:tag:ciphertext (all hex).
 * @param {string} plaintext
 * @returns {string}
 */
const encrypt = (plaintext) => {
  if (plaintext == null) return null;
  const key = getKey();
  const iv  = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
};

/**
 * Decrypt a value encrypted with encrypt().
 * @param {string} ciphertext - "iv:tag:encrypted" hex string
 * @returns {string}
 */
const decrypt = (ciphertext) => {
  if (ciphertext == null) return null;
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const key     = getKey();
  const iv      = Buffer.from(ivHex, 'hex');
  const tag     = Buffer.from(tagHex, 'hex');
  const enc     = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
};

/**
 * Hash a value with SHA-256 (for searching encrypted fields).
 * Store alongside encrypted values to allow equality lookups.
 * @param {string} value
 * @returns {string} hex digest
 */
const hash = (value) => {
  if (value == null) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

module.exports = { encrypt, decrypt, hash };