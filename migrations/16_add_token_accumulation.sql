-- ============================================================
-- Migration 16: Add Token Accumulation System
--
-- Purpose: Enable token accumulation before Poin deduction
-- - User generate token < tokens_per_poin threshold → accumulate, no Poin deducted
-- - User generate token >= tokens_per_poin threshold → deduct Poin, reset remainder
--
-- How it works:
--   Every AI generate → add rawTokens to token_accumulated
--   If accumulated >= tokens_per_poin → deduct Poin, remainder = accumulated % tokens_per_poin
--   On monthly reset → reset both Poin quota AND token_accumulated
--
-- Admin sets tokens_per_poin in admin dashboard (stored in system_settings)
-- ============================================================

-- PART 1: Add accumulation columns to users table
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_accumulated INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_accumulated_month DATE;

COMMENT ON COLUMN users.token_accumulated IS 'Total token yang terakumulasi. Dipotong Poin saat >= tokens_per_poin threshold.';
COMMENT ON COLUMN users.token_accumulated_month IS 'Bulan saat akumulasi terakhir di-reset (YYYY-MM-01).';

-- PART 2: Migration for existing users
-- ============================================================

-- Initialize accumulated tokens to 0 for all existing users
UPDATE users SET token_accumulated = 0, token_accumulated_month = CURRENT_DATE WHERE token_accumulated IS NULL;

-- PART 3: Create index for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_token_accumulated ON users(id) WHERE token_accumulated > 0;

-- PART 4: Seed default tokens_per_poin if not exists
-- ============================================================

INSERT INTO system_settings (key, value, updated_at)
VALUES ('tokens_per_poin', '2000', NOW())
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Rollback:
--   ALTER TABLE users DROP COLUMN IF EXISTS token_accumulated;
--   ALTER TABLE users DROP COLUMN IF EXISTS token_accumulated_month;
--   DROP INDEX IF EXISTS idx_users_token_accumulated;
-- ============================================================
