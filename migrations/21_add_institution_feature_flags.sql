-- Migration: Institution Feature Flags
-- Tabel BARU untuk rollout bertahap fitur Kepsek/Wakasek (per-institusi).
-- Prinsip §6.2: fitur baru dinyalakan per institusi sebelum di-rollout global.
CREATE TABLE IF NOT EXISTS institution_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (institution_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_institution_feature_flags_inst ON institution_feature_flags (institution_id);