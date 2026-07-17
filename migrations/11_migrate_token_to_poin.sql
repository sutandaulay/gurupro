-- ============================================
-- MIGRATION: Token System → Poin System
-- Migration ID: 11_migrate_token_to_poin
-- Date: 2026-07-17
-- Description: Migrate dari sistem kuota Token ke sistem Poin
-- Konversi: 2000 token = 1 Poin (dibulatkan ke atas, min 1)
-- ============================================

-- ============================================
-- PART 1: Add new columns to users table
-- ============================================

-- Tambah kolom Poin ke tabel users (SAFE - tidak hapus data lama)
ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_poin_total INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_poin_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS addon_poin INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS addon_poin_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS addon_poin_grace_period_ends TIMESTAMP;

-- ============================================
-- PART 2: Create poin_transactions ledger table
-- ============================================

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

-- Indexes for poin_transactions
CREATE INDEX IF NOT EXISTS idx_poin_transactions_user_id ON poin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_poin_transactions_feature ON poin_transactions(feature);
CREATE INDEX IF NOT EXISTS idx_poin_transactions_created_at ON poin_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poin_transactions_source ON poin_transactions(source);

-- ============================================
-- PART 3: Update addon_token_packages table
-- ============================================

-- Tambah kolom untuk Poin di addon packages
ALTER TABLE addon_token_packages ADD COLUMN IF NOT EXISTS poin_amount INTEGER;
ALTER TABLE addon_token_packages ADD COLUMN IF NOT EXISTS token_amount_old INTEGER; -- Backup old token_amount

-- Backup old value
UPDATE addon_token_packages SET token_amount_old = token_amount;

-- Update: poin_amount = token_amount / 2000 (dibulatkan ke atas, min 1)
UPDATE addon_token_packages
SET poin_amount = GREATEST(1, CEIL(token_amount::NUMERIC / 2000))
WHERE token_amount IS NOT NULL;

-- ============================================
-- PART 4: Update pricing_plans table
-- ============================================

-- Tambah kolom untuk Poin di pricing plans
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS poin INTEGER;
ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS tokens_old INTEGER; -- Backup old tokens

-- Backup old value
UPDATE pricing_plans SET tokens_old = tokens;

-- Update: poin = tokens / 2000 (dibulatkan ke atas, min 1)
UPDATE pricing_plans
SET poin = GREATEST(1, CEIL(COALESCE(tokens, 0)::NUMERIC / 2000))
WHERE tokens IS NOT NULL;

-- ============================================
-- PART 5: Backup old TokenUsage if needed
-- ============================================

-- Rename existing TokenUsage columns for backup
ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS tokens_charged_old INTEGER;
UPDATE "TokenUsage" SET tokens_charged_old = tokens_charged;

-- ============================================
-- PART 6: Migrate data dari token ke poin
-- ============================================

-- Konversi token_limit → quota_poin_total (pastikan min 1 Poin)
UPDATE users
SET quota_poin_total = GREATEST(1, CEIL(COALESCE(token_limit, 0)::NUMERIC / 2000))
WHERE token_limit IS NOT NULL AND token_limit > 0;

-- Konversi addon_token_balance → addon_poin (pastikan min 1 Poin)
UPDATE users
SET addon_poin = GREATEST(1, CEIL(COALESCE(addon_token_balance, 0)::NUMERIC / 2000))
WHERE addon_token_balance IS NOT NULL AND addon_token_balance > 0;

-- Set grace period untuk add-on existing (14 hari)
UPDATE users
SET addon_poin_grace_period_ends = NOW() + INTERVAL '14 days'
WHERE addon_poin > 0 AND addon_poin_grace_period_ends IS NULL;

-- ============================================
-- PART 7: Create backup view for old data
-- ============================================

CREATE OR REPLACE VIEW v_users_token_backup AS
SELECT
  id,
  email,
  nama_lengkap,
  role,
  token_limit as old_token_limit,
  addon_token_balance as old_addon_token_balance,
  quota_poin_total,
  quota_poin_used,
  addon_poin,
  addon_poin_used,
  grace_period_ends_at,
  addon_poin_grace_period_ends
FROM users;

-- ============================================
-- VERIFICATION QUERIES (run these to check migration)
-- ============================================

-- Check 1: Users dengan Poin migrated
-- SELECT COUNT(*) as users_with_poin FROM users WHERE quota_poin_total > 0;

-- Check 2: Sample migration (showing before vs after)
-- SELECT
--   email,
--   token_limit as old_token,
--   quota_poin_total as new_poin,
--   addon_token_balance as old_addon,
--   addon_poin as new_addon_poin
-- FROM users
-- WHERE token_limit IS NOT NULL
-- LIMIT 10;

-- Check 3: Addon packages migration
-- SELECT name, token_amount_old, poin_amount FROM addon_token_packages;

-- Check 4: Pricing plans migration
-- SELECT package_name, tokens_old, poin FROM pricing_plans;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

-- To rollback:
-- ALTER TABLE users DROP COLUMN IF EXISTS quota_poin_total;
-- ALTER TABLE users DROP COLUMN IF EXISTS quota_poin_used;
-- ALTER TABLE users DROP COLUMN IF EXISTS addon_poin;
-- ALTER TABLE users DROP COLUMN IF EXISTS addon_poin_used;
-- ALTER TABLE users DROP COLUMN IF EXISTS addon_poin_grace_period_ends;
-- DROP TABLE IF EXISTS poin_transactions;
-- ALTER TABLE addon_token_packages DROP COLUMN IF EXISTS poin_amount;
-- ALTER TABLE addon_token_packages DROP COLUMN IF EXISTS token_amount_old;
-- ALTER TABLE pricing_plans DROP COLUMN IF EXISTS poin;
-- ALTER TABLE pricing_plans DROP COLUMN IF EXISTS tokens_old;
-- DROP VIEW IF EXISTS v_users_token_backup;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
