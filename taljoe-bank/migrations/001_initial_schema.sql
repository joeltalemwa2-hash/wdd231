-- ================================================================
-- Taljoe Fintech — Database Schema
-- migrations/001_initial_schema.sql
--
-- Run with: psql -U taljoe_admin -d taljoe_bank -f this_file.sql
-- Or via: npm run migrate
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable pgcrypto for secure random
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM TYPES ───────────────────────────────────────────────────

CREATE TYPE user_status AS ENUM ('pending_kyc', 'active', 'suspended', 'closed');
CREATE TYPE kyc_status  AS ENUM ('not_submitted', 'pending', 'approved', 'rejected');
CREATE TYPE tx_type     AS ENUM ('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'fee', 'reversal');
CREATE TYPE tx_status   AS ENUM ('pending', 'processing', 'completed', 'failed', 'reversed');
CREATE TYPE tx_channel  AS ENUM ('mtn_momo', 'airtel_money', 'bank_transfer', 'internal', 'cash');
CREATE TYPE kyc_doc_type AS ENUM ('national_id', 'passport', 'driving_license');

-- ── USERS ────────────────────────────────────────────────────────

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_hash          VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 of phone for lookups
  phone_encrypted     TEXT NOT NULL,               -- AES-256-GCM encrypted phone
  email               VARCHAR(255) UNIQUE,
  full_name           VARCHAR(255) NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,        -- bcrypt hash
  status              user_status NOT NULL DEFAULT 'pending_kyc',
  kyc_status          kyc_status  NOT NULL DEFAULT 'not_submitted',
  pin_hash            VARCHAR(255),                 -- bcrypt hash of transaction PIN
  failed_login_count  INT NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone_hash ON users(phone_hash);
CREATE INDEX idx_users_status     ON users(status);

-- ── KYC DOCUMENTS ────────────────────────────────────────────────

CREATE TABLE kyc_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type        kyc_doc_type NOT NULL,
  doc_number_hash VARCHAR(64) NOT NULL,    -- hashed for lookup
  doc_number_enc  TEXT NOT NULL,           -- encrypted for storage
  full_name       VARCHAR(255) NOT NULL,
  date_of_birth   DATE,
  front_image_url TEXT,                    -- S3/Cloudinary URL
  back_image_url  TEXT,
  selfie_url      TEXT,
  reviewer_notes  TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_user_id ON kyc_documents(user_id);

-- ── ACCOUNTS ─────────────────────────────────────────────────────
-- Each user has one main account. Balance stored in UGX (integer, no floats).
-- 1 UGX = 1 unit. No decimal currency issues.

CREATE TABLE accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_number  VARCHAR(20) UNIQUE NOT NULL,  -- e.g. TJ-20240001
  balance         BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),  -- UGX, no negatives
  daily_spent     BIGINT NOT NULL DEFAULT 0,    -- resets at midnight
  daily_reset_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  is_frozen       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id        ON accounts(user_id);
CREATE INDEX idx_accounts_account_number ON accounts(account_number);

-- ── TRANSACTIONS ─────────────────────────────────────────────────

CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id          UUID NOT NULL REFERENCES accounts(id),
  user_id             UUID NOT NULL REFERENCES users(id),
  type                tx_type    NOT NULL,
  status              tx_status  NOT NULL DEFAULT 'pending',
  channel             tx_channel NOT NULL,
  amount              BIGINT NOT NULL CHECK (amount > 0),          -- UGX
  fee                 BIGINT NOT NULL DEFAULT 0 CHECK (fee >= 0),  -- UGX
  net_amount          BIGINT NOT NULL,  -- amount - fee (what hits the balance)
  balance_before      BIGINT NOT NULL,
  balance_after       BIGINT NOT NULL,
  currency            VARCHAR(3) NOT NULL DEFAULT 'UGX',
  description         TEXT,
  category            VARCHAR(100),
  -- External payment provider fields
  provider_tx_id      VARCHAR(255),  -- MTN/Airtel reference
  provider_status     VARCHAR(100),
  provider_response   JSONB,         -- full provider response for audit
  -- Transfer fields
  counterpart_account VARCHAR(20),   -- account number of other party
  counterpart_name    VARCHAR(255),
  counterpart_phone   TEXT,          -- encrypted
  -- Metadata
  ip_address          INET,
  device_fingerprint  VARCHAR(255),
  failure_reason      TEXT,
  reversed_by         UUID REFERENCES transactions(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_tx_account_id    ON transactions(account_id);
CREATE INDEX idx_tx_user_id       ON transactions(user_id);
CREATE INDEX idx_tx_status        ON transactions(status);
CREATE INDEX idx_tx_created_at    ON transactions(created_at DESC);
CREATE INDEX idx_tx_provider_id   ON transactions(provider_tx_id) WHERE provider_tx_id IS NOT NULL;

-- ── REFRESH TOKENS ───────────────────────────────────────────────

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of the actual token
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash    ON refresh_tokens(token_hash);

-- ── AUDIT LOG ─────────────────────────────────────────────────────
-- Immutable record of all security-relevant events.

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  event_type  VARCHAR(100) NOT NULL,
  event_data  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id    ON audit_log(user_id);
CREATE INDEX idx_audit_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);

-- Audit log is append-only — prevent updates and deletes
CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ── ACCOUNT NUMBER SEQUENCE ──────────────────────────────────────

CREATE SEQUENCE account_number_seq START 1000 INCREMENT 1;

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tx_updated_at       BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── DAILY SPEND RESET FUNCTION ───────────────────────────────────
-- Called before each transaction to reset daily_spent if date has rolled over.

CREATE OR REPLACE FUNCTION reset_daily_spend_if_needed(p_account_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE accounts
  SET    daily_spent   = 0,
         daily_reset_at = CURRENT_DATE
  WHERE  id            = p_account_id
    AND  daily_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;