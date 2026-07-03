-- Multi-school support: add sekolah_id to all PKG 2026 tables

ALTER TABLE laporan_kinerja ADD COLUMN IF NOT EXISTS sekolah_id UUID REFERENCES schools(id);
ALTER TABLE evidence_log ADD COLUMN IF NOT EXISTS sekolah_id UUID REFERENCES schools(id);
ALTER TABLE skp_tahunan ADD COLUMN IF NOT EXISTS sekolah_id UUID REFERENCES schools(id);
ALTER TABLE observasi_kinerja ADD COLUMN IF NOT EXISTS sekolah_id UUID REFERENCES schools(id);
ALTER TABLE pelatihan_guru ADD COLUMN IF NOT EXISTS sekolah_id UUID REFERENCES schools(id);
ALTER TABLE dokumen_bukti ADD COLUMN IF NOT EXISTS sekolah_id UUID REFERENCES schools(id);

CREATE INDEX IF NOT EXISTS idx_laporan_kinerja_sekolah ON laporan_kinerja(sekolah_id);
CREATE INDEX IF NOT EXISTS idx_evidence_log_sekolah ON evidence_log(sekolah_id);
CREATE INDEX IF NOT EXISTS idx_skp_tahunan_sekolah ON skp_tahunan(sekolah_id);
CREATE INDEX IF NOT EXISTS idx_observasi_kinerja_sekolah ON observasi_kinerja(sekolah_id);
CREATE INDEX IF NOT EXISTS idx_pelatihan_guru_sekolah ON pelatihan_guru(sekolah_id);
CREATE INDEX IF NOT EXISTS idx_dokumen_bukti_sekolah ON dokumen_bukti(sekolah_id);
