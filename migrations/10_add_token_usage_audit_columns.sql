-- Tambah kolom audit ke tabel TokenUsage agar seluruh fitur AI tercatat
-- (feature, model, provider, success, error_message, duration_ms, tokens_charged)

ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS "feature" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS "model" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS "success" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS "duration_ms" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TokenUsage" ADD COLUMN IF NOT EXISTS "tokens_charged" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "TokenUsage_user_id_idx" ON "TokenUsage"("user_id");
CREATE INDEX IF NOT EXISTS "TokenUsage_feature_idx" ON "TokenUsage"("feature");
