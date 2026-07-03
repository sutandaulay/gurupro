-- Evidence-Based Performance Report Tables
-- Migration: add_evidence_tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tahun Ajaran with semester tracking
CREATE TABLE IF NOT EXISTS tahun_ajaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(50) NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    semester_type VARCHAR(20) DEFAULT 'full' CHECK (semester_type IN ('ganjil', 'genap', 'full')),
    semester VARCHAR(20), -- Current active semester: 'ganjil', 'genap', 'full'
    sekolah_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tahun ajaran if none exists
INSERT INTO tahun_ajaran (nama, tanggal_mulai, tanggal_selesai, is_active, semester_type, semester)
SELECT '2024/2025', '2024-07-15', '2025-06-30', true, 'full', 'full'
WHERE NOT EXISTS (SELECT 1 FROM tahun_ajaran LIMIT 1);

-- Also insert 2025/2026 for convenience
INSERT INTO tahun_ajaran (nama, tanggal_mulai, tanggal_selesai, semester_type, semester)
SELECT '2025/2026', '2025-07-15', '2026-06-30', 'full', 'ganjil'
WHERE NOT EXISTS (SELECT 1 FROM tahun_ajaran WHERE nama = '2025/2026');

-- Evidence Log - Auto-logged teacher activities
CREATE TABLE IF NOT EXISTS evidence_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tahun_ajaran_id UUID NOT NULL,
    semester VARCHAR(20) NOT NULL, -- 'ganjil', 'genap', 'full'
    kategori VARCHAR(50) NOT NULL,
    sub_kategori VARCHAR(100) NOT NULL,
    referensi_id UUID,
    referensi_tabel VARCHAR(100),
    judul VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    indikator_kinerja TEXT[] DEFAULT '{}',
    bobot_evidence INTEGER DEFAULT 1,
    tanggal_aktivitas DATE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evidence_guru_semester ON evidence_log(guru_id, tahun_ajaran_id, semester);
CREATE INDEX idx_evidence_kategori ON evidence_log(guru_id, kategori, tanggal_aktivitas);
CREATE INDEX idx_evidence_referensi ON evidence_log(referensi_id, referensi_tabel);

-- Unique constraint to prevent duplicate evidence logging
CREATE UNIQUE INDEX idx_evidence_unique_aktivitas
ON evidence_log(guru_id, referensi_id, referensi_tabel, sub_kategori)
WHERE referensi_id IS NOT NULL;

-- Pelatihan & Pengembangan Diri
CREATE TABLE IF NOT EXISTS pelatihan_guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tahun_ajaran_id UUID,
    semester VARCHAR(20),
    nama_pelatihan VARCHAR(255) NOT NULL,
    penyelenggara VARCHAR(255) NOT NULL,
    jenis VARCHAR(50) NOT NULL,
    lingkup VARCHAR(50) NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    durasi_jam INTEGER NOT NULL,
    nomor_sertifikat VARCHAR(100),
    deskripsi TEXT,
    relevansi_mapel BOOLEAN DEFAULT true,
    kompetensi_dikembangkan TEXT[] DEFAULT '{}',
    file_sertifikat_url TEXT,
    file_sertifikat_nama VARCHAR(255),
    status_verifikasi VARCHAR(50) DEFAULT 'belum_upload',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pelatihan_guru_semester ON pelatihan_guru(guru_id, tahun_ajaran_id, semester);

-- Dokumen Bukti Tambahan
CREATE TABLE IF NOT EXISTS dokumen_bukti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tahun_ajaran_id UUID,
    semester VARCHAR(20),
    kategori VARCHAR(50) NOT NULL,
    judul VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    tanggal_dokumen DATE,
    penerbit VARCHAR(255),
    file_url TEXT NOT NULL,
    file_nama VARCHAR(255) NOT NULL,
    file_tipe VARCHAR(50) NOT NULL,
    file_ukuran INTEGER,
    indikator_kinerja TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dokumen_bukti_guru_semester ON dokumen_bukti(guru_id, tahun_ajaran_id, semester);

-- Laporan Kinerja
CREATE TABLE IF NOT EXISTS laporan_kinerja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tahun_ajaran_id UUID NOT NULL,
    semester VARCHAR(20) NOT NULL,
    judul VARCHAR(255) NOT NULL,
    content JSONB,
    evidence_summary JSONB,
    status VARCHAR(50) DEFAULT 'draft',
    ai_generated_at TIMESTAMP,
    file_pdf_url TEXT,
    file_docx_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_laporan_kinerja_guru_semester ON laporan_kinerja(guru_id, tahun_ajaran_id, semester);

-- Konfigurasi Indikator Kinerja
CREATE TABLE IF NOT EXISTS indikator_kinerja_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode VARCHAR(20) NOT NULL UNIQUE,
    nama VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    komponen VARCHAR(50) NOT NULL,
    bobot_persen INTEGER DEFAULT 10,
    min_evidence INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    berlaku_sejak DATE,
    sumber_regulasi VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Indikator Kinerja default (sesuai PKG/P3K Kemendikdasmen)
INSERT INTO indikator_kinerja_config (kode, nama, deskripsi, komponen, bobot_persen, min_evidence, is_active) VALUES
('IK-01', 'Perencanaan Pembelajaran', 'Menyusun perangkat pembelajaran sesuai kurikulum yang berlaku', 'perencanaan', 15, 6, true),
('IK-02', 'Pengembangan Perangkat Ajar', 'Mengembangkan ATP, modul ajar, dan LKPD', 'perencanaan', 10, 4, true),
('IK-03', 'Pelaksanaan Pembelajaran', 'Melaksanakan pembelajaran yang efektif dan terdokumentasi', 'pelaksanaan', 20, 12, true),
('IK-04', 'Dokumentasi Pembelajaran', 'Mendokumentasikan setiap pertemuan melalui jurnal mengajar', 'pelaksanaan', 10, 12, true),
('IK-05', 'Asesmen Pembelajaran', 'Melaksanakan asesmen diagnostik, formatif, dan sumatif', 'penilaian', 10, 3, true),
('IK-06', 'Evaluasi Hasil Belajar', 'Menganalisis hasil belajar dan melaporkannya', 'penilaian', 5, 2, true),
('IK-07', 'Tindak Lanjut Pembelajaran', 'Memberikan remedial dan pengayaan berdasarkan hasil asesmen', 'tindak_lanjut', 10, 2, true),
('IK-08', 'Refleksi Praktik Mengajar', 'Melakukan refleksi untuk perbaikan pembelajaran berkelanjutan', 'refleksi', 5, 4, true),
('IK-09', 'Kolaborasi dengan Orang Tua', 'Membangun komunikasi produktif dengan orang tua/wali siswa', 'kolaborasi', 5, 2, true),
('IK-10', 'Pengembangan Kompetensi Profesional', 'Mengikuti pelatihan dan pengembangan diri yang relevan', 'pengembangan_diri', 5, 1, true),
('IK-11', 'Kontribusi pada Komunitas Belajar', 'Aktif dalam MGMP, komunitas belajar, atau berbagi praktik baik', 'pengembangan_diri', 3, 1, true),
('IK-12', 'Inovasi Pembelajaran', 'Mengembangkan media, metode, atau proyek pembelajaran inovatif', 'inovasi', 2, 1, true)
ON CONFLICT (kode) DO NOTHING;
