/**
 * Taljoe Fintech — Audit Log Model
 * src/models/audit.model.js
 */

'use strict';

const { query } = require('../config/database');

const AuditModel = {
  async log({ userId, eventType, eventData, ipAddress, userAgent }) {
    await query(`
      INSERT INTO audit_log (user_id, event_type, event_data, ip_address, user_agent)
      VALUES ($1, $2, $3::jsonb, $4::inet, $5)
    `, [userId || null, eventType, eventData ? JSON.stringify(eventData) : null, ipAddress || null, userAgent || null]);
  },

  async getByUser(userId, limit = 50) {
    const { rows } = await query(
      'SELECT * FROM audit_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return rows;
  },
};

module.exports = AuditModel;