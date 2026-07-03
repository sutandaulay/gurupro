-- PKG 2026 Tables (Kepmendikdasmen No. 271/O/2025)
-- SKP Tahunan, Observasi Kinerja, Predikat

-- 1. SKP Tahunan - Perencanaan Kinerja di awal tahun
CREATE TABLE IF NOT EXISTS skp_tahunan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tahun_ajaran_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    catatan_guru TEXT,
    catatan_kepsek TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guru_id, tahun_ajaran_id)
);

CREATE INDEX idx_skp_guru_tahun ON skp_tahunan(guru_id, tahun_ajaran_id);

-- 2. Indikator yang dipilih dalam SKP
CREATE TABLE IF NOT EXISTS skp_indikator (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skp_id UUID NOT NULL REFERENCES skp_tahunan(id) ON DELETE CASCADE,
    indikator_id UUID NOT NULL REFERENCES indikator_kinerja_config(id),
    target_self DECIMAL(5,2) DEFAULT 0,
    target_sk DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skp_id, indikator_id)
);

-- 3. Observasi Kinerja oleh Kepala Sekolah/Atasan
CREATE TABLE IF NOT EXISTS observasi_kinerja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skp_id UUID REFERENCES skp_tahunan(id),
    observer_id UUID REFERENCES users(id),
    tahun_ajaran_id UUID NOT NULL,
    tanggal_observasi DATE NOT NULL,
    jenis VARCHAR(50) DEFAULT 'kelas',
    suasana_pembelajaran TEXT,
    catatan_observer TEXT,
    rekomendasi TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_observasi_guru ON observasi_kinerja(guru_id, tahun_ajaran_id);

-- 4. Rating per indikator per observasi
CREATE TABLE IF NOT EXISTS observasi_indikator (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observasi_id UUID NOT NULL REFERENCES observasi_kinerja(id) ON DELETE CASCADE,
    indikator_id UUID NOT NULL REFERENCES indikator_kinerja_config(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 4),
    catatan TEXT,
    bukti_observasi TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(observasi_id, indikator_id)
);

-- 5. Tambah kolom predikat & relasi ke laporan_kinerja
ALTER TABLE laporan_kinerja ADD COLUMN IF NOT EXISTS skp_id UUID REFERENCES skp_tahunan(id);
ALTER TABLE laporan_kinerja ADD COLUMN IF NOT EXISTS predikat VARCHAR(50);
ALTER TABLE laporan_kinerja ADD COLUMN IF NOT EXISTS total_observasi INTEGER DEFAULT 0;
ALTER TABLE laporan_kinerja ADD COLUMN IF NOT EXISTS rata_rata_rating DECIMAL(3,2);
