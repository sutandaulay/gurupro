import { Pool } from 'pg';

// Inisialisasi pool koneksi database postgresql lokal Anda
const pool = new Pool({
  user: 'postgres',          // sesuaikan dengan username pgAdmin Anda
  host: 'localhost',
  database: 'gurupro_db',    // nama database lokal Anda
  password: 'nus4nt4r4', // sesuaikan dengan password postgres Anda
  port: 5432,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

// Skrip Migrasi Otomatis untuk Tabel Operasional Sekolah & Presensi
const initDb = async () => {
  try {
    // Pastikan ekstensi pgcrypto terpasang jika dibutuhkan
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // 1. Tabel Schools
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        nama_sekolah VARCHAR(255) NOT NULL,
        logo TEXT,
        alamat TEXT,
        npsn VARCHAR(50),
        nama_kepala_sekolah VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Tabel Classes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        nama_kelas VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Tabel Subjects
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        nama_mapel VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Tabel Schedules
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        hari VARCHAR(50) NOT NULL,
        jam_mulai VARCHAR(50) NOT NULL,
        jam_selesai VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Tabel Students
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        nama_siswa VARCHAR(255) NOT NULL,
        nisn VARCHAR(50),
        nomor_absen INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Tabel Teacher Attendance (Presensi Mengajar Guru)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teacher_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        tanggal DATE NOT NULL,
        status VARCHAR(50) NOT NULL,
        catatan TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Tabel Student Attendance (Presensi Siswa per Jam Pelajaran)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        tanggal DATE NOT NULL,
        status VARCHAR(50) NOT NULL,
        catatan TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Tabel Journal Schemas (Format Form Dinamis)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_schemas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        nama_skema VARCHAR(255) NOT NULL,
        fields JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Tabel Teacher Journals (Entri Jurnal Mengajar)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teacher_journals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
        class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
        materi_pembelajaran VARCHAR(255) NOT NULL,
        tujuan_pembelajaran TEXT NOT NULL,
        aktivitas_pembelajaran TEXT NOT NULL,
        media_pembelajaran TEXT,
        asesmen_pembelajaran TEXT,
        refleksi_guru TEXT,
        tindak_lanjut TEXT,
        evidensi JSONB DEFAULT '[]'::jsonb,
        custom_values JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'Draft',
        supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. Tabel Journal Supervisions (Catatan Evaluasi / Persetujuan Supervisi)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_supervisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journal_id UUID NOT NULL REFERENCES teacher_journals(id) ON DELETE CASCADE,
        supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        catatan_supervisi TEXT NOT NULL,
        rekomendasi TEXT,
        status_persetujuan VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Tabel Guru Administrasi (Dokumen RPP, Silabus, ATP, Prota, Promes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guru_administrasi (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tipe_dokumen VARCHAR(50) NOT NULL,
        judul_dokumen VARCHAR(255) NOT NULL,
        konten JSONB NOT NULL,
        tanggal_kegiatan DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. Tabel Academic Calendars
    await pool.query(`
      CREATE TABLE IF NOT EXISTS academic_calendars (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        event_name VARCHAR(255) NOT NULL,
        tanggal_mulai DATE NOT NULL,
        tanggal_selesai DATE NOT NULL,
        keterangan TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. Tabel Assessments (Evaluasi Nilai & KKM)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        nama_asesmen VARCHAR(255) NOT NULL,
        tipe_asesmen VARCHAR(50) NOT NULL, -- 'Diagnostik', 'Formatif', 'Sumatif'
        kkm INTEGER NOT NULL DEFAULT 70,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 14. Tabel Student Grades (Buku Nilai & Remedial Tracker)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_grades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        nilai_awal NUMERIC(5,2) NOT NULL,
        nilai_remedial NUMERIC(5,2),
        nilai_akhir NUMERIC(5,2) NOT NULL,
        status_remedial VARCHAR(50) NOT NULL DEFAULT 'Lulus', -- 'Lulus', 'Butuh Remedial', 'Remedial Selesai'
        catatan TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 15. Tabel Audit Trails (Jejak Log Audit)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_trails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        aksi VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ALTER TABLE checks to dynamically support TAMS supervisor and homeroom teacher fields
    await pool.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS nama_pengawas VARCHAR(255)');
    await pool.query('ALTER TABLE classes ADD COLUMN IF NOT EXISTS wali_kelas VARCHAR(255)');

    // Signatory configuration columns in schools table
    await pool.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS nip_kepala_sekolah VARCHAR(255)');
    await pool.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS nip_pengawas VARCHAR(255)');
    await pool.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS nama_wali_kelas VARCHAR(255)');
    await pool.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS nip_wali_kelas VARCHAR(255)');
    await pool.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS show_ttd_kepala BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS show_ttd_pengawas BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS show_ttd_wali BOOLEAN DEFAULT TRUE');

    // 16. Alter users table to support referrals and bank details
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS cashback_balance INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(150)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP WITHOUT TIME ZONE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITHOUT TIME ZONE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
    
    // Backfill default values for existing users with null subscription fields
    await pool.query(`
      UPDATE users 
      SET 
        subscription_start = COALESCE(subscription_start, CURRENT_TIMESTAMP),
        subscription_end = COALESCE(subscription_end, CURRENT_TIMESTAMP + INTERVAL '30 days'),
        status_langganan = COALESCE(status_langganan, 'free')
      WHERE subscription_start IS NULL OR subscription_end IS NULL OR status_langganan IS NULL
    `);

    // 17. Create referrals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reward_tokens INTEGER DEFAULT 0,
        cashback_amount INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 18. Create cms_landing table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cms_landing (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 19. Create payout_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payout_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tipe VARCHAR(50) NOT NULL,
        jumlah INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        catatan TEXT,
        bank_name VARCHAR(100),
        bank_account_number VARCHAR(50),
        bank_account_name VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure payout_requests has bank columns (added after initial creation)
    await pool.query('ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)');
    await pool.query('ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50)');
    await pool.query('ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(150)');

    // 20. Alter users table to support password and OTP auth
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(80)');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (LOWER(username)) WHERE username IS NOT NULL');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP');

    // Ensure transactions table exists with correct schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        external_id VARCHAR(255),
        amount NUMERIC(12,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        payment_method VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50)');
    await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT');

    // 21. Create system_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Pre-populate system_settings if empty
    const checkSettings = await pool.query("SELECT COUNT(*) FROM system_settings");
    if (parseInt(checkSettings.rows[0].count) === 0) {
      // Payment gateways
      await pool.query(
        "INSERT INTO system_settings (key, value) VALUES ($1, $2)",
        ["payment_gateway", JSON.stringify({
          default_gateway: "mock",
          xendit: { api_key: "", verification_token: "", is_sandbox: true },
          midtrans: { merchant_id: "", client_key: "", server_key: "", is_sandbox: true },
          duitku: { merchant_code: "", api_key: "", is_sandbox: true }
        })]
      );

      // Email sender
      await pool.query(
        "INSERT INTO system_settings (key, value) VALUES ($1, $2)",
        ["email_sender", JSON.stringify({
          provider: "smtp",
          active: false,
          smtp: { host: "smtp.mailtrap.io", port: 2525, secure: false, user: "", pass: "" },
          sender_name: "GuruPRO Support",
          sender_email: "no-reply@gurupro.id"
        })]
      );

      // WhatsApp sender
      await pool.query(
        "INSERT INTO system_settings (key, value) VALUES ($1, $2)",
        ["wa_sender", JSON.stringify({
          provider: "fonnte",
          active: false,
          fonnte: { token: "", sender_number: "" },
          ruangwa: { token: "", sender_number: "" }
        })]
      );

      // Notification templates
      await pool.query(
        "INSERT INTO system_settings (key, value) VALUES ($1, $2)",
        ["notification_templates", JSON.stringify({
          register: {
            email_enabled: true,
            wa_enabled: true,
            email_subject: "Selamat Datang di GuruPRO!",
            email_body: "<div style=\"font-family: sans-serif; padding: 20px;\"><h2 style=\"color: #4f46e5;\">Selamat Datang di GuruPRO, {nama_lengkap}!</h2><p>Terima kasih telah mendaftar di GuruPRO. Akun Anda berhasil dibuat dengan email <strong>{email}</strong>.</p><p>Kode referral unik Anda adalah: <strong style=\"color: #4f46e5;\">{referral_code}</strong>. Gunakan kode ini untuk mengundang guru lain dan dapatkan cashback!</p><p>Selamat berkarya!</p></div>",
            wa_message: "Halo Ibu/Bapak *{nama_lengkap}*,\n\nSelamat datang di GuruPRO! 🎉 Akun Anda telah berhasil didaftarkan.\n\nKode referral Anda adalah: *{referral_code}*\nBagikan kode ini untuk mendapatkan saldo cashback dan token tambahan!\n\nMari bersama majukan pendidikan Indonesia dengan kemudahan administrasi sekolah! 🚀"
          },
          forgot_password: {
            email_enabled: true,
            wa_enabled: true,
            email_subject: "Kode OTP Masuk GuruPRO",
            email_body: "<div style=\"font-family: sans-serif; padding: 20px;\"><h2 style=\"color: #4f46e5;\">Kode Akses Masuk GuruPRO</h2><p>Halo Ibu/Bapak <strong>{nama_lengkap}</strong>,</p><p>Berikut adalah kode OTP untuk masuk/reset password akun GuruPRO Anda:</p><h1 style=\"letter-spacing: 5px; color: #4f46e5; text-align: center;\">{otp_code}</h1><p>Kode ini berlaku selama 10 menit. Mohon tidak membagikan kode ini kepada siapapun.</p></div>",
            wa_message: "Halo Ibu/Bapak *{nama_lengkap}*,\n\nBerikut adalah kode OTP masuk GuruPRO Anda:\n\n*`{otp_code}`*\n\nKode ini berlaku selama 10 menit. Demi keamanan, jangan sebarkan kode ini kepada siapapun. Terima kasih!"
          },
          payout_approved: {
            email_enabled: true,
            wa_enabled: true,
            email_subject: "Pencairan Cashback GuruPRO Berhasil!",
            email_body: "<div style=\"font-family: sans-serif; padding: 20px;\"><h2 style=\"color: #10b981;\">Pencairan Cashback Berhasil!</h2><p>Halo Ibu/Bapak <strong>{nama_lengkap}</strong>,</p><p>Pengajuan pencairan saldo cashback Anda sebesar <strong>Rp {amount}</strong> telah disetujui dan berhasil ditransfer oleh Admin ke rekening tujuan Anda:</p><p><strong>{bank_name} - {bank_account_number} (a/n {bank_account_name})</strong></p><p>Terima kasih atas partisipasi Anda dalam program referral GuruPRO! Terus bagikan kode referral Anda untuk mendapatkan lebih banyak cashback.</p></div>",
            wa_message: "Halo Ibu/Bapak *{nama_lengkap}*,\n\nKabar baik! 🎉 Pengajuan pencairan saldo cashback Anda sebesar *Rp {amount}* telah *DISETUJUI* oleh Admin dan ditransfer ke rekening tujuan:\n\n*Bank*: {bank_name}\n*Rekening*: {bank_account_number}\n*Atas Nama*: {bank_account_name}\n\nTerima kasih telah aktif menggunakan program referral GuruPRO! Terus undang guru lain dan kumpulkan cashback-nya! 💰"
          },
          payout_rejected: {
            email_enabled: true,
            wa_enabled: true,
            email_subject: "Pencairan Cashback GuruPRO Ditolak",
            email_body: "<div style=\"font-family: sans-serif; padding: 20px;\"><h2 style=\"color: #ef4444;\">Pengajuan Pencairan Ditolak</h2><p>Halo Ibu/Bapak <strong>{nama_lengkap}</strong>,</p><p>Mohon maaf, pengajuan pencairan saldo cashback Anda sebesar <strong>Rp {amount}</strong> ke rekening:</p><p><strong>{bank_name} - {bank_account_number} (a/n {bank_account_name})</strong></p><p>telah ditolak oleh admin dengan alasan/catatan:</p><p style=\"background: #fee2e2; padding: 10px; border-radius: 8px; color: #991b1b;\"><em>{catatan}</em></p><p>Saldo cashback Anda telah dikembalikan secara utuh ke saldo akun Anda. Silakan periksa kembali detail rekening Anda atau hubungi Admin jika diperlukan.</p></div>",
            wa_message: "Halo Ibu/Bapak *{nama_lengkap}*,\n\nInformasi penting. Pengajuan pencairan cashback Anda sebesar *Rp {amount}* ditolak oleh admin.\n\n*Alasan*: {catatan}\n\nSaldo cashback Anda telah dikembalikan secara utuh ke akun. Silakan koreksi informasi rekening di tab Profil dan ajukan kembali. Terima kasih."
          },
          payment_success: {
            email_enabled: true,
            wa_enabled: true,
            email_subject: "Pembayaran Langganan GuruPRO Berhasil",
            email_body: "<div style=\"font-family: sans-serif; padding: 20px;\"><h2 style=\"color: #4f46e5;\">Pembayaran Berhasil!</h2><p>Halo Ibu/Bapak <strong>{nama_lengkap}</strong>,</p><p>Terima kasih atas pembayarannya! Pembayaran Anda sebesar <strong>Rp {amount}</strong> untuk paket <strong>{plan_name}</strong> telah berhasil kami terima via <strong>{payment_method}</strong>.</p><p>Kuota token Anda telah bertambah sebanyak <strong>+{tokens_added} Token</strong> dan status akun Anda sekarang aktif sebagai <strong>PRO</strong>.</p><p>Selamat berkarya!</p></div>",
            wa_message: "Halo Ibu/Bapak *{nama_lengkap}*,\n\nTerima kasih! Pembayaran sebesar *Rp {amount}* untuk paket *{plan_name}* telah diterima via *{payment_method}*.\n\nAkun Anda telah diaktifkan ke *PRO* dan kuota Anda telah bertambah *+{tokens_added} Token*! 🎉\n\nSelamat berkreasi dengan GuruPRO! ✨"
          }
        })]
      );
    }

    // Inisialisasi ai_config jika belum ada
    const checkAi = await pool.query("SELECT COUNT(*) FROM system_settings WHERE key = 'ai_config'");
    if (parseInt(checkAi.rows[0].count) === 0) {
      await pool.query(
        "INSERT INTO system_settings (key, value) VALUES ($1, $2)",
        ["ai_config", JSON.stringify({
          default_vendor: "mock",
          gemini: { api_key: "", model_name: "gemini-2.5-flash" },
          openai: { api_key: "", model_name: "gpt-4o-mini" },
          claude: { api_key: "", model_name: "claude-3-5-sonnet-20241022" },
          deepseek: { api_key: "", model_name: "deepseek-chat" }
        })]
      );
    }

    // Inisialisasi pricing_config jika belum ada atau migrasi ke 4 paket
    const checkPricing = await pool.query("SELECT value FROM system_settings WHERE key = 'pricing_config'");
    const defaultPricing = {
      free: { price: 0, tokens: 10, duration_days: 30 },
      three_month: { price: 120000, tokens: 500, duration_days: 90 },
      six_month: { price: 220000, tokens: 1100, duration_days: 180 },
      one_year: { price: 400000, tokens: 2500, duration_days: 365 }
    };
    if (checkPricing.rows.length === 0) {
      await pool.query(
        "INSERT INTO system_settings (key, value) VALUES ($1, $2)",
        ["pricing_config", JSON.stringify(defaultPricing)]
      );
    } else {
      const val = checkPricing.rows[0].value;
      if (!val.free || !val.three_month || !val.six_month || !val.one_year) {
        await pool.query(
          "UPDATE system_settings SET value = $1 WHERE key = $2",
          [JSON.stringify(defaultPricing), "pricing_config"]
        );
      }
    }


    // Pre-populate cms_landing with default content if empty
    const checkCms = await pool.query("SELECT COUNT(*) FROM cms_landing");
    if (parseInt(checkCms.rows[0].count) === 0) {
      const defaultCms = {
        hero_badge: "✨ Next-Gen AI Edu-Platform untuk Guru Indonesia",
        hero_title: "Pangkas Waktu Administrasi,\nBuat Soal Ujian Otomatis dengan AI",
        hero_subtitle: "GuruPRO membantu pendidik merumuskan administrasi kelas dan butir soal ujian berkualitas tinggi berbasis Taksonomi Bloom (HOTS/LOTS) dalam hitungan detik.",
        features: [
          { icon: "🧠", title: "Generator Soal Komprehensif", desc: "Cukup masukkan topik, AI akan menyusun soal Pilihan Ganda (PG), PG Kompleks, Isian Singkat, Uraian, hingga Menjodohkan secara akurat." },
          { icon: "📊", title: "Standar Taksonomi Bloom", desc: "Sesuaikan level kognitif asesmen murid Anda dari tingkat rendah (LOTS C1-C3) hingga penalaran kritis tingkat tinggi (HOTS C4-C6)." },
          { icon: "🖨️", title: "Siap Cetak & Ekspor", desc: "Dilengkapi dengan format Kop Surat Ujian resmi sekolah otomatis. Siap dicetak langsung ke printer atau disalin ke dokumen Microsoft Word Anda." }
        ],
        faq: [
          { question: "Bagaimana cara kerja perhitungan Token kuota?", answer: "Setiap kali Anda menekan tombol generate paket butir soal baru, sistem akan memotong 1 Token dari sisa batas limit token Anda. Token ini akan otomatis diperbarui setiap masa tagihan bulanan berjalan." },
          { question: "Apakah metode pembayaran mendukung e-Wallet lokal?", answer: "Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia." }
        ],
        referral_terms: "Dapatkan cashback senilai Rp10.000 tunai dan +20 Token kuota untuk setiap guru yang mendaftar dan berlangganan menggunakan kode referral unik Anda! Teman Anda juga akan mendapatkan bonus +10 Token saat mendaftar.",
        min_payout_cashback: 50000,
        cashback_to_token_rate: 1000
      };
      await pool.query(
        "INSERT INTO cms_landing (key, value) VALUES ($1, $2)",
        ["landing_config", JSON.stringify(defaultCms)]
      );
    }

    // Populate referral_code for users who don't have one
    const nullRefUsers = await pool.query("SELECT id FROM users WHERE referral_code IS NULL");
    for (const r of nullRefUsers.rows) {
      const code = "GPRO-" + Math.random().toString(36).substring(2, 7).toUpperCase();
      await pool.query("UPDATE users SET referral_code = $1 WHERE id = $2", [code, r.id]);
    }

    console.log("SaaS Academic & TAMS tables checked/initialized successfully");
  } catch (err) {
    console.error("Failed to initialize SaaS Academic & TAMS tables:", err);
  }
};

export const logAudit = async (userId: string | null, aksi: string, deskripsi: string, ipAddress: string = '127.0.0.1') => {
  try {
    await pool.query(
      `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [userId, aksi, deskripsi, ipAddress]
    );
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
};

initDb();
