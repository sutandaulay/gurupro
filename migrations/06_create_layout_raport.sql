-- ==========================================
-- MIGRATION: 06_create_layout_raport
-- Purpose: Layout Builder untuk template raport
-- Relasi langsung ke template_raport (app-side PostgreSQL, bukan Payload collection)
-- Date: 2026-07-10
-- ==========================================

BEGIN;

-- ==========================================
-- 1. TABLE: layout_raport
-- Layout desain per template, reusable lintas periode
-- ==========================================
CREATE TABLE IF NOT EXISTS layout_raport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_raport_id UUID NOT NULL REFERENCES template_raport(id) ON DELETE CASCADE,
  sekolah_id UUID NOT NULL,
  nama_layout VARCHAR(255) NOT NULL,
  sections JSONB NOT NULL,
  created_by_wali_kelas_member_id UUID NOT NULL,
  last_edited_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_layout_raport_template
  ON layout_raport (template_raport_id);

CREATE INDEX IF NOT EXISTS idx_layout_raport_sekolah
  ON layout_raport (sekolah_id);

COMMENT ON TABLE layout_raport IS 'Layout desain raport per template, reusable lintas periode';
COMMENT ON COLUMN layout_raport.sections IS 'Array of { sectionType, order, wajib, varianTampilan, visible, config }';
COMMENT ON COLUMN layout_raport.created_by_wali_kelas_member_id IS 'FK ke institution-members.id';
COMMENT ON COLUMN layout_raport.last_edited_at IS 'Trigger-based last edit timestamp';

-- ==========================================
-- 2. TRIGGER: auto-update last_edited_at
-- ==========================================
CREATE OR REPLACE FUNCTION update_layout_raport_last_edited()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_edited_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_layout_raport_last_edited_trigger ON layout_raport;
CREATE TRIGGER update_layout_raport_last_edited_trigger
  BEFORE UPDATE ON layout_raport
  FOR EACH ROW EXECUTE FUNCTION update_layout_raport_last_edited();

COMMIT;
