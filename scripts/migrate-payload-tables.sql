-- Payload CMS Tables Migration Script
-- Run this script to create Payload CMS tables

-- Create Features table (cms-features collection)
CREATE TABLE IF NOT EXISTS cms_features (
    id SERIAL PRIMARY KEY,
    icon VARCHAR(255) DEFAULT 'IconSparkles',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Why Points table (why-points collection)
CREATE TABLE IF NOT EXISTS why_points (
    id SERIAL PRIMARY KEY,
    point TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Categories table if not exists
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Posts table if not exists
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    content TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    author VARCHAR(255),
    "publishedDate" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Media table if not exists
CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    mime_type VARCHAR(100),
    filesize INTEGER,
    width INTEGER,
    height INTEGER,
    url VARCHAR(500),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Users table if not exists
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'guru',
    provider VARCHAR(50) DEFAULT 'email',
    google_id VARCHAR(255),
    whatsapp VARCHAR(50),
    school VARCHAR(255),
    level VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    tokens INTEGER DEFAULT 10,
    subscription_status VARCHAR(50) DEFAULT 'free',
    referral_code VARCHAR(50),
    referral_by VARCHAR(255),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create System Settings table (if not exists)
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Wallets table if not exists
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10, 2) DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Transactions table if not exists
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    gateway VARCHAR(50),
    external_id VARCHAR(255),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default index records for Payload
INSERT INTO cms_features (icon, title, description, "order", "isActive")
VALUES
    ('IconFileTextAi', 'Pembuat RPP AI', 'Buat RPP sesuai Kurikulum Merdeka otomatis dalam hitungan menit. Cukup masukkan topik dan kelas, AI akan menyusun RPP lengkap dengan tujuan pembelajaran, kegiatan, dan asesmen.', 0, true),
    ('IconBook2', 'Jurnal Mengajar', 'Catat aktivitas harian kelas dengan mudah dan cepat. Jurnal tersinkronisasi otomatis dengan RPP dan kalender akademik sekolah.', 1, true),
    ('IconClipboardCheck', 'Absensi Digital', 'Kelola kehadiran siswa secara digital, lengkap dengan rekap otomatis dan ekspor ke Excel. Orang tua juga mendapat notifikasi kehadiran.', 2, true),
    ('IconReportAnalytics', 'Buku Nilai & Rapor', 'Input nilai, hitung otomatis berdasarkan bobot penilaian, dan cetak rapor siap pakai. Mendukung berbagai format rapor Kurikulum Merdeka dan K13.', 3, true),
    ('IconAward', 'PKG & SKP', 'Bantu proses Penilaian Kinerja Guru dan Sasaran Kinerja Pegawai dengan panduan AI. Lengkap dengan template dokumen yang sesuai regulasi.', 4, true),
    ('IconMessages', 'Komunikasi Orang Tua', 'Kirim notifikasi perkembangan siswa ke wali murid secara real-time. Fitur chat dan laporan periodik memudahkan kolaborasi sekolah dengan orang tua.', 5, true)
ON CONFLICT DO NOTHING;

INSERT INTO why_points (point, "order", "isActive")
VALUES
    ('Sesuai regulasi Kemenag & Kemendikbud terbaru', 0, true),
    ('Tersedia offline-first, cocok untuk daerah sinyal lemah', 1, true),
    ('Harga terjangkau, mulai Rp 49.000/bulan', 2, true),
    ('Data tersimpan aman, sesuai UU PDP No. 27/2022', 3, true)
ON CONFLICT DO NOTHING;

-- Insert default system settings if not exists
INSERT INTO system_settings (key, value)
VALUES
    ('landing_hero', '{"badge":"✨ Didukung VideaClass AI","headline":"Administrasi Guru Lebih Cepat dengan AI","subheadline":"GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.","stats":[{"number":"50.000+","label":"Guru Aktif"},{"number":"6","label":"Modul Lengkap"},{"number":"10x","label":"Lebih Cepat"}]}'),
    ('landing_footer', '{"description":"Platform administrasi guru berbasis AI untuk membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor dalam satu platform.","contactEmail":"support@gurupro.id","contactWhatsapp":"+62 812-8396-0337","copyrightText":"GuruPRO AI © 2026","links":[{"label":"Beranda","url":"/","column":"links"},{"label":"Fitur","url":"/#fitur","column":"links"},{"label":"Harga","url":"/#harga","column":"links"},{"label":"Blog","url":"/blog","column":"links"}],"socialLinks":[{"platform":"facebook","url":"https://facebook.com/guruproai"},{"platform":"instagram","url":"https://instagram.com/guruproai"},{"platform":"youtube","url":"https://youtube.com/@guruproai"},{"platform":"tiktok","url":"https://tiktok.com/@guruproai"}]}'),
    ('faq_config', '[{"question":"Bagaimana cara kerja perhitungan Poin kuota?","answer":"Setiap kali Anda menekan tombol generate paket butir soal baru, sistem akan memotong 1 Poin dari sisa batas limit poin Anda. Poin ini akan otomatis diperbarui setiap masa tagihan bulanan berjalan."},{"question":"Apakah metode pembayaran mendukung e-Wallet lokal?","answer":"Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia."}]'),
    ('referral_config', '{"badge":"🎁 Program Kemitraan Guru","title":"Bagikan GuruPro, Dapatkan Cashback & Poin!","description":"Dapatkan cashback senilai Rp10.000 tunai dan +20 Poin kuota untuk setiap guru yang mendaftar dan berlangganan menggunakan kode referral unik Anda! Teman Anda juga akan mendapatkan bonus +10 Poin saat mendaftar.","benefits":[{"icon":"💰","title":"Cashback Saldo Dompet","description":"Saldo cashback sebesar Rp10.000 ditambahkan ke dompet akun Anda setiap kali teman Anda meng-upgrade status akun menjadi PRO. Saldo ini dapat dicairkan langsung ke rekening bank."},{"icon":"⚡","title":"Poin Kuota Tambahan","description":"Dapatkan +20 Poin kuota ekstra gratis untuk generator soal Anda, sementara teman Anda mendapatkan +10 Poin kuota tambahan saat mendaftar!"}],"ctaText":"Mulai Undang Teman","ctaLink":""}')
ON CONFLICT (key) DO NOTHING;

SELECT 'Payload CMS tables created successfully!' as result;
