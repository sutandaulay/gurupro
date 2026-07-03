-- Seed data: 12 Standar Indikator Kinerja PKG 2026
-- Kepmendikdasmen No. 271/O/2025

INSERT INTO indikator_kinerja_config (kode, nama, deskripsi, komponen, bobot_persen, min_evidence, berlaku_sejak, sumber_regulasi)
VALUES
  ('IK-01', 'Perencanaan Pembelajaran', 'Menyusun perencanaan pembelajaran sesuai kurikulum yang berlaku', 'perencanaan', 10, 2, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-02', 'Penyusunan Modul Ajar/RPP', 'Mengembangkan modul ajar atau RPP yang sistematis dan kontekstual', 'perencanaan', 10, 2, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-03', 'Pelaksanaan Pembelajaran', 'Melaksanakan pembelajaran yang aktif, kreatif, dan bermakna', 'pelaksanaan', 15, 4, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-04', 'Pengelolaan Kelas', 'Menciptakan dan mempertahankan lingkungan belajar yang kondusif', 'pelaksanaan', 10, 2, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-05', 'Penilaian Hasil Belajar', 'Melaksanakan asesmen formatif dan sumatif sesuai ketentuan', 'penilaian', 10, 2, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-06', 'Analisis Hasil Penilaian', 'Menganalisis hasil asesmen untuk perbaikan pembelajaran', 'penilaian', 5, 1, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-07', 'Tindak Lanjut Hasil Penilaian', 'Melaksanakan remedial, pengayaan, dan program perbaikan', 'penilaian', 5, 1, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-08', 'Refleksi Pembelajaran', 'Melakukan refleksi dan perbaikan berkelanjutan', 'pelaksanaan', 10, 2, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-09', 'Kolaborasi dan Komunikasi', 'Berkomunikasi dengan orang tua/wali dan pemangku kepentingan', 'kolaborasi', 5, 1, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-10', 'Pengembangan Diri Berkelanjutan', 'Mengikuti kegiatan pengembangan kompetensi profesional', 'pengembangan_diri', 10, 1, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-11', 'Publikasi Karya Ilmiah', 'Menghasilkan karya tulis, penelitian, atau inovasi pembelajaran', 'pengembangan_diri', 5, 1, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025'),
  ('IK-12', 'Keaktifan Organisasi Profesi', 'Berpartisipasi dalam organisasi profesi dan forum ilmiah', 'pengembangan_diri', 5, 1, '2025-07-01', 'Kepmendikdasmen No. 271/O/2025')
ON CONFLICT (kode) DO NOTHING;
