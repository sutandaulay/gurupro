-- ============================================
-- MIGRATION: Poin Ledger enhancements + Ratio Audit
-- Migration ID: 12_poin_ledger_and_ratio_audit
-- Date: 2026-07-18
-- Idempotent: aman dijalankan berulang kali.
-- ============================================

-- ------------------------------------------------------------
-- PART 1: token -> poin (dari migration 11, idempoten)
-- ------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_poin_total INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_poin_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS addon_poin INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS addon_poin_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS addon_poin_grace_period_ends TIMESTAMP;

CREATE TABLE IF NOT EXISTS poin_transactions (
  id VARCHAR(50) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature VARCHAR(100) NOT NULL DEFAULT 'unknown',
  raw_tokens INTEGER NOT NULL DEFAULT 0,
  poin_deducted INTEGER NOT NULL DEFAULT 0,
  source VARCHAR(20) NOT NULL CHECK (source IN ('main', 'addon', 'failed')),
  model VARCHAR(100) DEFAULT 'gemini-2.5-flash-lite',
  provider VARCHAR(50) DEFAULT 'gemini',
  mapel VARCHAR(100) DEFAULT '-',
  jenjang VARCHAR(50) DEFAULT '-',
  jumlah_soal INTEGER DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poin_transactions_user_id ON poin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_poin_transactions_feature ON poin_transactions(feature);
CREATE INDEX IF NOT EXISTS idx_poin_transactions_created_at ON poin_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poin_transactions_source ON poin_transactions(source);

-- Backup old token values (legacy)
ALTER TABLE addon_token_packages ADD COLUMN IF NOT EXISTS poin_amount INTEGER;
ALTER TABLE addon_token_packages ADD COLUMN IF NOT EXISTS token_amount_old INTEGER;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS poin INTEGER;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS tokens_old INTEGER;
ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS tokens_charged_old INTEGER;

UPDATE addon_token_packages SET token_amount_old = token_amount WHERE token_amount_old IS NULL;
UPDATE addon_token_packages SET poin_amount = GREATEST(1, CEIL(COALESCE(token_amount, 0)::NUMERIC / 2000)) WHERE poin_amount IS NULL AND token_amount IS NOT NULL;

UPDATE pricing_plans SET tokens_old = tokens WHERE tokens_old IS NULL;
UPDATE pricing_plans SET poin = GREATEST(1, CEIL(COALESCE(tokens, 0)::NUMERIC / 2000)) WHERE poin IS NULL AND tokens IS NOT NULL;

UPDATE "TokenUsage" SET tokens_charged_old = tokens_charged WHERE tokens_charged_old IS NULL;

-- Migrate data lama (flat unit) -> poin (legacy dibiarkan sebagai backup view)
UPDATE users
SET quota_poin_total = GREATEST(1, CEIL(COALESCE(token_limit, 0)::NUMERIC / 2000))
WHERE token_limit IS NOT NULL AND token_limit > 0 AND quota_poin_total IS NULL;

UPDATE users
SET addon_poin = GREATEST(1, CEIL(COALESCE(addon_token_balance, 0)::NUMERIC / 2000))
WHERE addon_token_balance IS NOT NULL AND addon_token_balance > 0 AND addon_poin IS NULL;

UPDATE users
SET addon_poin_grace_period_ends = NOW() + INTERVAL '14 days'
WHERE addon_poin > 0 AND addon_poin_grace_period_ends IS NULL;

DROP VIEW IF EXISTS v_users_token_backup;
CREATE OR REPLACE VIEW v_users_token_backup AS
SELECT id, email, nama_lengkap, role,
       token_limit as old_token_limit,
       addon_token_balance as old_addon_token_balance,
       quota_poin_total, quota_poin_used, addon_poin, addon_poin_used,
       grace_period_ends_at, addon_poin_grace_period_ends
FROM users;

-- ------------------------------------------------------------
-- PART 2: Ledger enhancements (Fase 1)
-- ------------------------------------------------------------

ALTER TABLE poin_transactions ADD COLUMN IF NOT EXISTS ratio_used_at_transaction INTEGER;
ALTER TABLE poin_transactions ADD COLUMN IF NOT EXISTS cached_tokens INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_poin_transactions_ratio ON poin_transactions(ratio_used_at_transaction);

-- ------------------------------------------------------------
-- PART 3: Ratio change audit log (terpisah dari ledger)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS poin_ratio_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID,
  old_ratio INTEGER NOT NULL,
  new_ratio INTEGER NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_poin_ratio_audit_changed_at ON poin_ratio_audit(changed_at DESC);

-- ------------------------------------------------------------
-- PART 4: system_settings default untuk tokens_per_poin
-- ------------------------------------------------------------

INSERT INTO system_settings (key, value, updated_at)
SELECT 'tokens_per_poin', '2000', NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'tokens_per_poin');

-- ============================================
-- ROLLBACK
-- ============================================
-- ALTER TABLE poin_transactions DROP COLUMN IF EXISTS ratio_used_at_transaction;
-- ALTER TABLE poin_transactions DROP COLUMN IF EXISTS cached_tokens;
-- DROP TABLE IF EXISTS poin_ratio_audit;
