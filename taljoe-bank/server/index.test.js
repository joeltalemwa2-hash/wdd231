/**
 * Taljoe Fintech — API Tests
 * server/index.test.js  (or tests/api.test.js)
 *
 * Run: npm test
 *
 * These tests use supertest against the Express app.
 * The DB calls are mocked so you don't need a real database to run tests.
 */

'use strict';

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(fn => fn({
    query: jest.fn().mockResolvedValue({ rows: [] }),
  })),
  ping: jest.fn().mockResolvedValue(new Date()),
  pool: { on: jest.fn() },
}));

jest.mock('../src/utils/logger', () => ({
  info:  jest.fn(),
  error: jest.fn(),
  warn:  jest.fn(),
  debug: jest.fn(),
}));

const request = require('supertest');
const app     = require('../src/server');
const db      = require('../src/config/database');

// ── Helper: fake auth token ───────────────────────────────────────
const jwt = require('jsonwebtoken');
process.env.JWT_ACCESS_SECRET  = 'test-access-secret-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.ENCRYPTION_KEY     = 'a'.repeat(64); // 64 hex chars for tests
process.env.NODE_ENV           = 'test';

const makeToken = (userId = 'user-uuid-123') =>
  jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

// ── Health ────────────────────────────────────────────────────────
describe('Health', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── Static / PWA ─────────────────────────────────────────────────
describe('Static PWA', () => {
  test('GET / returns HTML', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('Unknown routes fall back to index.html', async () => {
    const res = await request(app).get('/some/deep/page');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

// ── Auth: Register ────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  beforeEach(() => {
    db.query.mockResolvedValueOnce({ rows: [] })           // phone check (not found)
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })         // account number seq
      .mockResolvedValueOnce({ rows: [{ id: 'user-123', full_name: 'Joel T.', email: null, status: 'pending_kyc', kyc_status: 'not_submitted' }] }) // user insert
      .mockResolvedValueOnce({ rows: [{ id: 'acct-123', account_number: 'TJ-0000001', balance: 0 }] }) // account insert
      .mockResolvedValueOnce({ rows: [] }) // refresh token insert
      .mockResolvedValueOnce({ rows: [] }); // audit log
  });

  test('rejects missing phone', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Joel T.', password: 'Password1' });
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('Validation failed');
  });

  test('rejects weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ phone: '0771234567', fullName: 'Joel T.', password: 'weak' });
    expect(res.statusCode).toBe(422);
  });

  test('rejects invalid Uganda phone', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ phone: '12345', fullName: 'Joel T.', password: 'Password1' });
    expect(res.statusCode).toBe(422);
  });
});

// ── Auth: Login ───────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  test('rejects missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.statusCode).toBe(422);
  });
});

// ── Auth: Refresh ─────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  test('rejects missing token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.statusCode).toBe(400);
  });
});

// ── Protected Routes ──────────────────────────────────────────────
describe('Protected routes', () => {
  test('GET /api/account/balance without token returns 401', async () => {
    const res = await request(app).get('/api/account/balance');
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/payments/deposit without token returns 401', async () => {
    const res = await request(app).post('/api/payments/deposit').send({});
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/payments/withdraw without token returns 401', async () => {
    const res = await request(app).post('/api/payments/withdraw').send({});
    expect(res.statusCode).toBe(401);
  });
});

// ── Payment Validation ────────────────────────────────────────────
describe('Payment validation', () => {
  const token = makeToken();

  test('deposit rejects amount below 500', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 'u', full_name: 'Joel', status: 'active', kyc_status: 'approved', account_id: 'a', account_number: 'TJ-0000001', balance: 10000, is_frozen: false }] });
    const res = await request(app)
      .post('/api/payments/deposit')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '0771234567', amount: 100 });
    expect(res.statusCode).toBe(422);
  });

  test('deposit rejects invalid phone', async () => {
    const res = await request(app)
      .post('/api/payments/deposit')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '12345', amount: 5000 });
    expect(res.statusCode).toBe(422);
  });

  test('withdraw requires pin', async () => {
    const res = await request(app)
      .post('/api/payments/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '0771234567', amount: 5000 }); // no pin
    expect(res.statusCode).toBe(422);
  });

  test('transfer requires valid account number format', async () => {
    const res = await request(app)
      .post('/api/payments/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({ toAccountNumber: 'INVALID', amount: 1000, pin: '1234' });
    expect(res.statusCode).toBe(422);
  });
});

// ── Security ──────────────────────────────────────────────────────
describe('Security headers', () => {
  test('x-content-type-options is set', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('x-frame-options is set', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

// ── Webhooks (public, no auth) ────────────────────────────────────
describe('Webhooks', () => {
  test('POST /api/webhooks/mtn/deposit returns 200', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .post('/api/webhooks/mtn/deposit')
      .send({ referenceId: 'ref-123', status: 'SUCCESSFUL' });
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/webhooks/airtel returns 200', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .post('/api/webhooks/airtel')
      .send({ transaction: { id: 'ref-456', status: 'TS' } });
    expect(res.statusCode).toBe(200);
  });
});