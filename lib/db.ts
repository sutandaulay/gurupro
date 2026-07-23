import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Global singleton untuk database pool - persist across module reloads
const globalForPool = globalThis as unknown as {
  pool: Pool | undefined;
};

export const pool = globalForPool.pool ?? new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'gurupro_db',
  password: 'nus4nt4r4',
  port: 5432,
  options: '-c search_path=public,payload',
});

if (process.env.NODE_ENV !== 'production') {
  globalForPool.pool = pool;
}

// Export drizzle instance for use with schemas
export const db = drizzle(pool);

// Global singleton untuk init promise - prevent multiple initDb calls
const globalForInit = globalThis as unknown as {
  initPromise: Promise<void> | null;
};

let initPromise: Promise<void> | null = globalForInit.initPromise;

// Timeout wrapper for queries
export const queryWithTimeout = async (text: string, params?: any[], timeoutMs: number = 5000): Promise<any> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Query timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return await Promise.race([pool.query(text, params), timeoutPromise]);
  } catch (error: any) {
    if (error.message.includes('timed out')) {
      console.warn("[DB] Query timed out:", text.substring(0, 50) + "...");
    } else {
      console.error("[DB] Query error:", error.message);
    }
    throw error;
  }
};

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

// Skrip Migrasi Otomatis untuk Tabel Operasional Sekolah & Presensi
// Hanya dijalankan sekali dan di-cache
const initDb = async () => {
  console.log("[DB] Starting database initialization...");
  const startTime = Date.now();
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
        nis_lokal VARCHAR(50),
        nomor_absen INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add nis_lokal column if it doesn't exist (for existing tables)
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS nis_lokal VARCHAR(50)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_students_nis_lokal ON students(nis_lokal)`);

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
        school_id UUID,
        jenjang VARCHAR(50),
        kurikulum VARCHAR(50),
        owned_by_institution BOOLEAN DEFAULT FALSE,
        institution_id INTEGER,
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
        is_akhir_semester BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add is_akhir_semester column if it doesn't exist (for existing tables)
    await pool.query(`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS is_akhir_semester BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_assessments_akhir_semester ON assessments(class_id, subject_id) WHERE is_akhir_semester = true`);

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
    await pool.query('ALTER TABLE classes ADD COLUMN IF NOT EXISTS wali_kelas_user_id UUID REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_classes_wali_kelas_user_id ON classes(wali_kelas_user_id)');

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
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS addon_token_balance INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS main_token_reset_date TIMESTAMP');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) DEFAULT \'active\'');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_expiry_warning_sent VARCHAR(10)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS cashback_balance INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(150)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP WITHOUT TIME ZONE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITHOUT TIME ZONE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT');
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_tone VARCHAR(20) DEFAULT 'hangat' CHECK (notification_tone IN ('hangat', 'formal', 'santai'))");
    
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
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS pdp_consent_given BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS pdp_consent_version VARCHAR(50)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS pdp_consent_date TIMESTAMP');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT \'individual\'');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_invitation_token VARCHAR(255)');

    // Ensure payload schema changes are applied
    await pool.query('ALTER TABLE payload.otp_verifications ADD COLUMN IF NOT EXISTS purpose VARCHAR(50) DEFAULT \'password_reset\'');
    await pool.query('ALTER TABLE payload.otp_verifications ALTER COLUMN performance_share_link_id DROP NOT NULL');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payload.invitations (
        id SERIAL PRIMARY KEY,
        institution_id INTEGER REFERENCES payload.institutions(id) ON DELETE CASCADE,
        invited_email VARCHAR(255),
        invited_phone VARCHAR(255),
        token VARCHAR(255) UNIQUE,
        expires_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        invited_by_id INTEGER REFERENCES payload.cms_users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // 21. Create addon poin package table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS addon_token_packages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        poin_amount INTEGER NOT NULL DEFAULT 0,
        price NUMERIC(12,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query('ALTER TABLE addon_token_packages ADD COLUMN IF NOT EXISTS description TEXT');

    // Seed default addon poin packages if empty
    const packageCount = await pool.query('SELECT COUNT(*) FROM addon_token_packages');
    if (parseInt(packageCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO addon_token_packages (name, poin_amount, price, is_active, sort_order, description)
        VALUES
          ('Paket 50 Poin', 50, 25000, TRUE, 1, 'Poin eceran untuk kebutuhan sesekali'),
          ('Paket 100 Poin', 100, 45000, TRUE, 2, 'Poin eceran dengan nilai lebih hemat'),
          ('Paket 250 Poin', 250, 95000, TRUE, 3, 'Poin eceran untuk kebutuhan intensif')
      `);
    } else {
      // Rename existing seed data to Poin labels
      await pool.query(`
        UPDATE addon_token_packages
        SET
          name = CASE
            WHEN LOWER(name) LIKE 'paket 50 token' THEN 'Paket 50 Poin'
            WHEN LOWER(name) LIKE 'paket 100 token' THEN 'Paket 100 Poin'
            WHEN LOWER(name) LIKE 'paket 250 token' THEN 'Paket 250 Poin'
            ELSE name
          END,
          description = CASE
            WHEN description ILIKE '%Token eceran untuk kebutuhan sesekali%' THEN 'Poin eceran untuk kebutuhan sesekali'
            WHEN description ILIKE '%Token eceran dengan nilai lebih hemat%' THEN 'Poin eceran dengan nilai lebih hemat'
            WHEN description ILIKE '%Token eceran untuk kebutuhan intensif%' THEN 'Poin eceran untuk kebutuhan intensif'
            ELSE description
          END
        WHERE
          name ILIKE '%Paket % Token%'
          OR description ILIKE '%Token%'
      `);
    }

    // 22. Create system_settings table
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
            wa_message: "Halo Ibu/Bapak *{nama_lengkap}*,\n\nSelamat datang di GuruPRO! 🎉 Akun Anda telah berhasil didaftarkan.\n\nKode referral Anda adalah: *{referral_code}*\nBagikan kode ini untuk mendapatkan saldo cashback dan poin tambahan!\n\nMari bersama majukan pendidikan Indonesia dengan kemudahan administrasi sekolah! 🚀"
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
            email_body: "<div style=\"font-family: sans-serif; padding: 20px;\"><h2 style=\"color: #4f46e5;\">Pembayaran Berhasil!</h2><p>Halo Ibu/Bapak <strong>{nama_lengkap}</strong>,</p><p>Terima kasih atas pembayarannya! Pembayaran Anda sebesar <strong>Rp {amount}</strong> untuk paket <strong>{plan_name}</strong> telah berhasil kami terima via <strong>{payment_method}</strong>.</p><p>Kuota poin Anda telah bertambah sebanyak <strong>+{tokens_added} Poin</strong> dan status akun Anda sekarang aktif sebagai <strong>PRO</strong>.</p><p>Selamat berkarya!</p></div>",
            wa_message: "Halo Ibu/Bapak *{nama_lengkap}*,\n\nTerima kasih! Pembayaran sebesar *Rp {amount}* untuk paket *{plan_name}* telah diterima via *{payment_method}*.\n\nAkun Anda telah diaktifkan ke *PRO* dan kuota Anda telah bertambah *+{tokens_added} Poin*! 🎉\n\nSelamat berkreasi dengan GuruPRO! ✨"
          },
          refund: {
            email_enabled: true,
            wa_enabled: true,
            email_subject: "Refund Pembayaran GuruPRO",
            email_body: "<div style=\"font-family: sans-serif; padding: 20px;\"><h2 style=\"color: #ef4444;\">Refund Pembayaran</h2><p>Halo Ibu/Bapak <strong>{nama_lengkap}</strong>,</p><p>Mohon maaf, pengajuan refund untuk pembayaran paket <strong>{plan_name}</strong> telah diproses oleh Admin.</p><p><strong>Detail Refund:</strong></p><ul style=\"background: #fee2e2; padding: 15px; border-radius: 8px; list-style: none;\"><li><strong>Jumlah Refund:</strong> Rp {refund_amount}</li><li><strong>Poin Dipotong:</strong> {refund_tokens} Poin</li><li><strong>Alasan:</strong> {reason}</li></ul><p>Poin Anda telah dikurangi sesuai jumlah yang tertera di atas. Jika ada pertanyaan, silakan hubungi Admin.</p></div>",
            wa_message: "Halo Ibu/Bapak *{nama_lengkap}*,\n\nInformasi penting. Refund untuk paket *{plan_name}* telah diproses oleh Admin.\n\n📋 *Detail Refund:*\n• Jumlah: *Rp {refund_amount}*\n• Poin Dipotong: *{refund_tokens} Poin*\n• Alasan: {reason}\n\nPoin Anda telah dikurangi. Hubungi Admin jika ada pertanyaan. Terima kasih."
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
          { question: "Bagaimana cara kerja perhitungan Poin kuota?", answer: "Setiap kali Anda menekan tombol generate paket butir soal baru, sistem akan memotong 1 Poin dari sisa batas limit poin Anda. Poin ini akan otomatis diperbarui setiap masa tagihan bulanan berjalan." },
          { question: "Apakah metode pembayaran mendukung e-Wallet lokal?", answer: "Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia." }
        ],
        referral_terms: "Dapatkan cashback senilai Rp10.000 tunai dan +20 Poin kuota untuk setiap guru yang mendaftar dan berlangganan menggunakan kode referral unik Anda! Teman Anda juga akan mendapatkan bonus +10 Poin saat mendaftar.",
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

    // Ensure tahun_ajaran has all required columns
    try {
      await pool.query('ALTER TABLE tahun_ajaran ADD COLUMN IF NOT EXISTS sekolah_id UUID');
      await pool.query("ALTER TABLE tahun_ajaran ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)");
      await pool.query("ALTER TABLE tahun_ajaran ADD COLUMN IF NOT EXISTS semester_type VARCHAR(20) DEFAULT 'full'");
      await pool.query("ALTER TABLE tahun_ajaran ADD COLUMN IF NOT EXISTS semester VARCHAR(20)");
    } catch { /* table might not exist yet */ }

    // 23. Add app_user_id to institution_members for app-side reference
    try {
      await pool.query('ALTER TABLE institution_members ADD COLUMN IF NOT EXISTS "app_user_id" UUID');
      await pool.query('CREATE INDEX IF NOT EXISTS institution_members_app_user_idx ON institution_members ("app_user_id")');
    } catch { /* table may not exist yet */ }

    // Add new enum values first (before setting defaults)
    try {
      await pool.query("ALTER TYPE enum_institution_members_status ADD VALUE IF NOT EXISTS 'invited' BEFORE 'active'");
    } catch { /* not a native enum or already exists */ }
    try {
      await pool.query("ALTER TYPE enum_institution_members_status ADD VALUE IF NOT EXISTS 'left' AFTER 'active'");
    } catch { /* not a native enum or already exists */ }
    try {
      await pool.query("ALTER TYPE enum_institution_members_status ADD VALUE IF NOT EXISTS 'rejected' AFTER 'left'");
    } catch { /* not a native enum or already exists */ }

    // Migrate data and set default (runs after enum values are available)
    try {
      await pool.query("UPDATE institution_members SET status = 'invited' WHERE status = 'pending'");
      await pool.query("UPDATE institution_members SET status = 'left' WHERE status = 'inactive'");
      await pool.query("ALTER TABLE institution_members ALTER COLUMN status SET DEFAULT 'invited'");
    } catch { /* column may be text type or table doesn't exist */ }

    // 24. Add document ownership fields to teacher_journals
    try {
      await pool.query('ALTER TABLE teacher_journals ADD COLUMN IF NOT EXISTS owned_by_institution BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE teacher_journals ADD COLUMN IF NOT EXISTS institution_id INTEGER');
    } catch { /* table may not exist yet */ }

    // 25. Add document ownership fields to guru_administrasi
    try {
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS owned_by_institution BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS institution_id INTEGER');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS school_id UUID');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS jenjang VARCHAR(50)');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS kurikulum VARCHAR(50)');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS fase VARCHAR(10)');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS semester INTEGER');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS dimensi8 JSONB DEFAULT \'[]\'');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS tahunAjaran VARCHAR(20)');
      await pool.query('ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS subject_id UUID');
    } catch { /* table may not exist yet */ }

    // 26. Create in_app_notifications table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS in_app_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'info',
          reference_type VARCHAR(50),
          reference_id VARCHAR(255),
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notif_user ON in_app_notifications (user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notif_unread ON in_app_notifications (user_id) WHERE is_read = FALSE');
    } catch { /* table may not exist yet */ }

    // 27. Create wali_kelas_assignments table (File 01: Relasi Wali Kelas)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS wali_kelas_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          kelas_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          wali_kelas_member_id UUID NOT NULL,
          tahun_ajaran VARCHAR(9) NOT NULL,
          semester VARCHAR(6) NOT NULL CHECK (semester IN ('ganjil', 'genap')),
          status VARCHAR(10) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
          ditugaskan_pada TIMESTAMP NOT NULL DEFAULT now(),
          ditugaskan_oleh UUID,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);

      // Indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_wali_kelas_kelas_periode
          ON wali_kelas_assignments (kelas_id, tahun_ajaran, semester)
          WHERE status = 'aktif'
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_wali_kelas_guru
          ON wali_kelas_assignments (wali_kelas_member_id, tahun_ajaran, semester)
          WHERE status = 'aktif'
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_wali_kelas_periode
          ON wali_kelas_assignments (tahun_ajaran, semester)
          WHERE status = 'aktif'
      `);

      // Unique constraint: only 1 active assignment per class per period
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_wali_kelas_aktif
          ON wali_kelas_assignments (kelas_id, tahun_ajaran, semester)
          WHERE status = 'aktif'
      `);

      // Trigger for auto-updating updated_at
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_wali_kelas_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_wali_kelas_assignments_updated_at ON wali_kelas_assignments
      `);
      await pool.query(`
        CREATE TRIGGER update_wali_kelas_assignments_updated_at
          BEFORE UPDATE ON wali_kelas_assignments
          FOR EACH ROW
          EXECUTE FUNCTION update_wali_kelas_updated_at()
      `);
    } catch (err) {
      console.error('Failed to create wali_kelas_assignments table:', err);
    }

    // 27b. Create teacher_streaks table (Sprint 1.3 — agregasi streak harian read-only)
    // Tabel BARU, tidak mengubah tabel teacher_journals atau tabel lain yang sudah berjalan.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS teacher_streaks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          current_streak INTEGER NOT NULL DEFAULT 0,
          longest_streak INTEGER NOT NULL DEFAULT 0,
          last_journal_date DATE,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (teacher_id)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_teacher_streaks_teacher ON teacher_streaks (teacher_id)');
    } catch (err) {
      console.error('Failed to create teacher_streaks table:', err);
    }

    // 28. Create sikap, ekstrakurikuler, catatan_wali_kelas tables (File 03)
    try {
      // Tabel penilaian_sikap
      await pool.query(`
        CREATE TABLE IF NOT EXISTS penilaian_sikap (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          siswa_id UUID NOT NULL REFERENCES students(id),
          kelas_id UUID NOT NULL REFERENCES classes(id),
          periode VARCHAR(30) NOT NULL,
          varian VARCHAR(30) NOT NULL CHECK (varian IN ('profil_pelajar_pancasila', 'dimensi_profil_lulusan_madrasah', 'profil_rahmatan_lil_alamin')),
          penilaian_per_dimensi JSONB NOT NULL,
          deskripsi_umum TEXT NOT NULL,
          dinilai_oleh UUID NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          UNIQUE (siswa_id, kelas_id, periode)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_penilaian_sikap_siswa ON penilaian_sikap(siswa_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_penilaian_sikap_kelas ON penilaian_sikap(kelas_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_penilaian_sikap_dinilai_oleh ON penilaian_sikap(dinilai_oleh)`);
      // Migration: Update penilaian_sikap.varian CHECK constraint
      try {
        await pool.query(`ALTER TABLE penilaian_sikap DROP CONSTRAINT IF EXISTS penilaian_sikap_varian_check`);
        await pool.query(`ALTER TABLE penilaian_sikap ADD CONSTRAINT penilaian_sikap_varian_check CHECK (varian IN ('profil_pelajar_pancasila', 'dimensi_profil_lulusan_madrasah', 'profil_rahmatan_lil_alamin'))`);
      } catch (_) {}

      // Tabel ekstrakurikuler
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ekstrakurikuler (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nama_ekskul VARCHAR(255) NOT NULL,
          kelas_id UUID NOT NULL REFERENCES classes(id),
          pembina_member_id UUID NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ekstrakurikuler_kelas ON ekstrakurikuler(kelas_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ekstrakurikuler_pembina ON ekstrakurikuler(pembina_member_id)`);
      await pool.query('ALTER TABLE ekstrakurikuler ALTER COLUMN pembina_member_id DROP NOT NULL');
      await pool.query('ALTER TABLE ekstrakurikuler ADD COLUMN IF NOT EXISTS pembina_user_id UUID REFERENCES users(id) ON DELETE SET NULL');
      await pool.query('ALTER TABLE ekstrakurikuler ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_ekstrakurikuler_pembina_user_id ON ekstrakurikuler(pembina_user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_ekstrakurikuler_owner_id ON ekstrakurikuler(owner_id)');

      // Tabel penilaian_ekstrakurikuler
      await pool.query(`
        CREATE TABLE IF NOT EXISTS penilaian_ekstrakurikuler (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          siswa_id UUID NOT NULL REFERENCES students(id),
          ekstrakurikuler_id UUID NOT NULL REFERENCES ekstrakurikuler(id),
          periode VARCHAR(30) NOT NULL,
          predikat VARCHAR(20) NOT NULL CHECK (predikat IN ('sangat_baik', 'baik', 'cukup', 'perlu_bimbingan')),
          deskripsi TEXT NOT NULL,
          dinilai_oleh UUID NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          UNIQUE (siswa_id, ekstrakurikuler_id, periode)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_penilaian_ekskul_siswa ON penilaian_ekstrakurikuler(siswa_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_penilaian_ekskul_ekskul ON penilaian_ekstrakurikuler(ekstrakurikuler_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_penilaian_ekskul_dinilai_oleh ON penilaian_ekstrakurikuler(dinilai_oleh)`);

      // Tabel catatan_wali_kelas
      await pool.query(`
        CREATE TABLE IF NOT EXISTS catatan_wali_kelas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          siswa_id UUID NOT NULL REFERENCES students(id),
          kelas_id UUID NOT NULL REFERENCES classes(id),
          periode VARCHAR(30) NOT NULL,
          catatan TEXT NOT NULL,
          ditulis_oleh UUID NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now(),
          UNIQUE (siswa_id, kelas_id, periode)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_catatan_wali_kelas_siswa ON catatan_wali_kelas(siswa_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_catatan_wali_kelas_kelas ON catatan_wali_kelas(kelas_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_catatan_wali_kelas_ditulis_oleh ON catatan_wali_kelas(ditulis_oleh)`);

      // Trigger for auto-updating updated_at
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_sikap_ekskul_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);
      await pool.query(`DROP TRIGGER IF EXISTS update_ekstrakurikuler_updated_at ON ekstrakurikuler`);
      await pool.query(`CREATE TRIGGER update_ekstrakurikuler_updated_at BEFORE UPDATE ON ekstrakurikuler FOR EACH ROW EXECUTE FUNCTION update_sikap_ekskul_updated_at()`);
      await pool.query(`DROP TRIGGER IF EXISTS update_catatan_wali_kelas_updated_at ON catatan_wali_kelas`);
      await pool.query(`CREATE TRIGGER update_catatan_wali_kelas_updated_at BEFORE UPDATE ON catatan_wali_kelas FOR EACH ROW EXECUTE FUNCTION update_sikap_ekskul_updated_at()`);
    } catch (err) {
      console.error('Failed to create sikap/ekskul/catatan_wali_kelas tables:', err);
    }

    // 28b. Create raport tables (File 04: Template Raport, Data Raport)
    try {
      // Table: template_raport
      await pool.query(`
        CREATE TABLE IF NOT EXISTS template_raport (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sekolah_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
          nama_template VARCHAR(255) NOT NULL,
          jalur_regulasi VARCHAR(20) NOT NULL CHECK (jalur_regulasi IN ('kemendikdasmen', 'kemenag')),
          jenjang VARCHAR(20) NOT NULL CHECK (jenjang IN ('paud', 'sd_mi', 'smp_mts', 'sma_ma', 'smk_mak')),
          kurikulum VARCHAR(20) NOT NULL CHECK (kurikulum IN ('kurikulum_merdeka', 'k13', 'kbc', 'hybrid')),
          jenis_laporan VARCHAR(20) NOT NULL CHECK (jenis_laporan IN ('tengah_semester', 'akhir_semester', 'kokurikuler_p5', 'kokurikuler_p2ra')),
          mode_nilai_akademik VARCHAR(20) NOT NULL CHECK (mode_nilai_akademik IN ('angka_kkm', 'angka_deskripsi', 'naratif_saja')),
          varian_sikap VARCHAR(30) CHECK (varian_sikap IN ('profil_pelajar_pancasila', 'dimensi_profil_lulusan_madrasah', 'profil_rahmatan_lil_alamin')),
          basis_deskripsi VARCHAR(30) NOT NULL CHECK (basis_deskripsi IN ('capaian_pembelajaran', 'alur_tujuan_pembelajaran', 'poin_materi')),
          sections JSONB NOT NULL DEFAULT '[]',
          is_default BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_template_raport_sekolah ON template_raport (sekolah_id, jalur_regulasi, jenjang, kurikulum, jenis_laporan)`);

      // Migration: Update CHECK constraints to include KBC and Hybrid options
      try {
        await pool.query(`ALTER TABLE template_raport DROP CONSTRAINT IF EXISTS template_raport_kurikulum_check`);
        await pool.query(`ALTER TABLE template_raport ADD CONSTRAINT template_raport_kurikulum_check CHECK (kurikulum IN ('kurikulum_merdeka', 'k13', 'kbc', 'hybrid'))`);
      } catch (_) {}
      try {
        await pool.query(`ALTER TABLE template_raport DROP CONSTRAINT IF EXISTS template_raport_varian_sikap_check`);
        await pool.query(`ALTER TABLE template_raport ADD CONSTRAINT template_raport_varian_sikap_check CHECK (varian_sikap IN ('profil_pelajar_pancasila', 'dimensi_profil_lulusan_madrasah', 'profil_rahmatan_lil_alamin'))`);
      } catch (_) {}
      try {
        await pool.query(`ALTER TABLE template_raport DROP CONSTRAINT IF EXISTS template_raport_jenis_laporan_check`);
        await pool.query(`ALTER TABLE template_raport ADD CONSTRAINT template_raport_jenis_laporan_check CHECK (jenis_laporan IN ('tengah_semester', 'akhir_semester', 'kokurikuler_p5', 'kokurikuler_p2ra'))`);
      } catch (_) {}

      // Table: data_raport
      await pool.query(`
        CREATE TABLE IF NOT EXISTS data_raport (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          siswa_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
          nisn VARCHAR(10) NOT NULL,
          nis_lokal VARCHAR(50) NOT NULL,
          kelas_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
          template_raport_id UUID NOT NULL REFERENCES template_raport(id) ON DELETE RESTRICT,
          periode VARCHAR(30) NOT NULL,
          jenis_laporan VARCHAR(20) NOT NULL CHECK (jenis_laporan IN ('tengah_semester', 'akhir_semester', 'kokurikuler_p5', 'kokurikuler_p2ra')),
          status VARCHAR(25) NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'dikirim_ke_wali_kelas', 'dikonfirmasi', 'difinalisasi', 'siap_print')),
          sikap_id UUID,
          catatan_wali_kelas TEXT,
          presensi_snapshot JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now(),
          UNIQUE (siswa_id, template_raport_id, periode)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_data_raport_siswa ON data_raport (siswa_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_data_raport_kelas ON data_raport (kelas_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_data_raport_status ON data_raport (status)`);
      // Migration: Update data_raport.jenis_laporan CHECK constraint
      try {
        await pool.query(`ALTER TABLE data_raport DROP CONSTRAINT IF EXISTS data_raport_jenis_laporan_check`);
        await pool.query(`ALTER TABLE data_raport ADD CONSTRAINT data_raport_jenis_laporan_check CHECK (jenis_laporan IN ('tengah_semester', 'akhir_semester', 'kokurikuler_p5', 'kokurikuler_p2ra'))`);
      } catch (_) {}


      // Table: data_raport_nilai_mapel
      await pool.query(`
        CREATE TABLE IF NOT EXISTS data_raport_nilai_mapel (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          data_raport_id UUID NOT NULL REFERENCES data_raport(id) ON DELETE CASCADE,
          mapel_id UUID NOT NULL,
          guru_mapel_member_id UUID NOT NULL,
          nilai_akhir NUMERIC(5,1),
          kkm NUMERIC(5,1),
          deskripsi_capaian TEXT NOT NULL DEFAULT '',
          deskripsi_sumber_ai BOOLEAN NOT NULL DEFAULT false,
          deskripsi_dibuka_untuk_review BOOLEAN NOT NULL DEFAULT false,
          dikonfirmasi_guru BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now(),
          UNIQUE (data_raport_id, mapel_id)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_data_raport_nilai_mapel_raport ON data_raport_nilai_mapel (data_raport_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_data_raport_nilai_mapel_guru ON data_raport_nilai_mapel (guru_mapel_member_id)`);

      // Table: data_raport_status_history
      await pool.query(`
        CREATE TABLE IF NOT EXISTS data_raport_status_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          data_raport_id UUID NOT NULL REFERENCES data_raport(id) ON DELETE CASCADE,
          status VARCHAR(25) NOT NULL,
          changed_at TIMESTAMP NOT NULL DEFAULT now(),
          changed_by UUID NOT NULL,
          changed_by_role VARCHAR(20)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_data_raport_status_history_raport ON data_raport_status_history (data_raport_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_data_raport_status_history_changed_by ON data_raport_status_history (changed_by)`);

      // Triggers for auto-updating updated_at
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_raport_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await pool.query(`DROP TRIGGER IF EXISTS update_template_raport_updated_at ON template_raport`);
      await pool.query(`CREATE TRIGGER update_template_raport_updated_at BEFORE UPDATE ON template_raport FOR EACH ROW EXECUTE FUNCTION update_raport_updated_at()`);
      await pool.query(`DROP TRIGGER IF EXISTS update_data_raport_updated_at ON data_raport`);
      await pool.query(`CREATE TRIGGER update_data_raport_updated_at BEFORE UPDATE ON data_raport FOR EACH ROW EXECUTE FUNCTION update_raport_updated_at()`);
      await pool.query(`DROP TRIGGER IF EXISTS update_data_raport_nilai_mapel_updated_at ON data_raport_nilai_mapel`);
      await pool.query(`CREATE TRIGGER update_data_raport_nilai_mapel_updated_at BEFORE UPDATE ON data_raport_nilai_mapel FOR EACH ROW EXECUTE FUNCTION update_raport_updated_at()`);

      // Validation function: Cek role guru
      await pool.query(`
        CREATE OR REPLACE FUNCTION validate_guru_mapel_member(p_member_id UUID)
        RETURNS BOOLEAN AS $$
        DECLARE
          v_role VARCHAR(20);
        BEGIN
          SELECT imr.value INTO v_role
      FROM institution_members im
      JOIN institution_members_role imr ON imr.parent_id = im.id
      WHERE im.app_user_id = p_member_id
        AND imr.value = 'guru'
          LIMIT 1;
          RETURN v_role IS NOT NULL;
        END;
        $$ LANGUAGE plpgsql
      `);
    } catch (err) {
      console.error('Failed to create raport tables:', err);
    }

    // 29. Create layout_raport table (File 06: Layout Builder)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS layout_raport (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_raport_id UUID NOT NULL REFERENCES template_raport(id) ON DELETE CASCADE,
          sekolah_id UUID NOT NULL,
          nama_layout VARCHAR(255) NOT NULL,
          sections JSONB NOT NULL,
          created_by_wali_kelas_member_id UUID NOT NULL,
          last_edited_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_layout_raport_template
          ON layout_raport (template_raport_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_layout_raport_sekolah
          ON layout_raport (sekolah_id)
      `);
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_layout_raport_last_edited()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.last_edited_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS update_layout_raport_last_edited_trigger ON layout_raport
      `);
      await pool.query(`
        CREATE TRIGGER update_layout_raport_last_edited_trigger
          BEFORE UPDATE ON layout_raport
          FOR EACH ROW EXECUTE FUNCTION update_layout_raport_last_edited()
      `);
    } catch (err) {
      console.error('Failed to create layout_raport table:', err);
    }

    // 30. Create kontak_eksternal_raport table (File 07: Kontak Eksternal + OTP-Link)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS kontak_eksternal_raport (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          guru_mapel_member_id UUID NOT NULL,
          nama_kontak VARCHAR(255) NOT NULL,
          kontak_wa VARCHAR(20),
          kontak_email VARCHAR(255),
          kelas_id UUID NOT NULL REFERENCES classes(id),
          link_token VARCHAR(255) NOT NULL UNIQUE,
          otp_expired_at TIMESTAMP NOT NULL,
          status_klaim VARCHAR(15) NOT NULL DEFAULT 'belum_klaim' CHECK (status_klaim IN ('belum_klaim', 'sudah_klaim')),
          claimed_by_member_id UUID,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_link_token ON kontak_eksternal_raport (link_token)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_guru_mapel ON kontak_eksternal_raport (guru_mapel_member_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_kelas ON kontak_eksternal_raport (kelas_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_raport_otp_expired ON kontak_eksternal_raport (otp_expired_at)`);

      // 31. Create kontak_eksternal_akses_log table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS kontak_eksternal_akses_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          kontak_eksternal_id UUID NOT NULL REFERENCES kontak_eksternal_raport(id),
          accessed_at TIMESTAMP NOT NULL DEFAULT now(),
          ip_address VARCHAR(45)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_akses_log_kontak ON kontak_eksternal_akses_log (kontak_eksternal_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_kontak_eksternal_akses_log_accessed ON kontak_eksternal_akses_log (accessed_at)`);

      // 32. Create pemetaan_kolom_profile table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pemetaan_kolom_profile (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sekolah_id UUID NOT NULL,
          jalur_regulasi VARCHAR(20) NOT NULL CHECK (jalur_regulasi IN ('kemendikdasmen', 'kemenag')),
          urutan_siswa VARCHAR(20) NOT NULL CHECK (urutan_siswa IN ('abjad_nama', 'nomor_absen', 'nisn')),
          urutan_kolom JSONB NOT NULL,
          system_version_catatan VARCHAR(100),
          last_validated_at TIMESTAMP NOT NULL DEFAULT now(),
          UNIQUE (sekolah_id, jalur_regulasi)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pemetaan_kolom_profile_sekolah ON pemetaan_kolom_profile (sekolah_id)`);
    } catch (err) {
      console.error('Failed to create kontak eksternal / pemetaan kolom tables:', err);
    }

    // 33. Create user_storage tables (user-created folders and files)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_folders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          parent_id UUID REFERENCES user_folders(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_folders_user ON user_folders (user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_folders_parent ON user_folders (parent_id)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_folders_unique_name ON user_folders (user_id, parent_id, name)`);
      await pool.query(`ALTER TABLE user_folders ADD COLUMN IF NOT EXISTS pin VARCHAR(255)`);
      await pool.query(`ALTER TABLE user_folders ADD COLUMN IF NOT EXISTS pin_reset_code VARCHAR(6)`);
      await pool.query(`ALTER TABLE user_folders ADD COLUMN IF NOT EXISTS pin_reset_expires_at TIMESTAMP`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          folder_id UUID REFERENCES user_folders(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          r2_key TEXT NOT NULL,
          r2_url TEXT NOT NULL,
          size BIGINT NOT NULL DEFAULT 0,
          mime_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_files_user ON user_files (user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_files_folder ON user_files (folder_id)`);
    } catch (err) {
      console.error('Failed to create user_storage tables:', err);
    }

    // 34. Tabel TAMS (Attendance Devices, Logs, Summary, Leave Requests)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS attendance_devices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          browser_fingerprint VARCHAR(255) NOT NULL,
          device_label VARCHAR(100),
          registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          last_seen_at TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_devices_teacher ON attendance_devices (teacher_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_devices_fingerprint ON attendance_devices (browser_fingerprint)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS attendance_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
          assignment_id VARCHAR(255) NOT NULL,
          type VARCHAR(20) NOT NULL,
          class_session_id UUID,
          subject_id UUID,
          timestamp TIMESTAMP NOT NULL,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          accuracy DOUBLE PRECISION,
          ip_address VARCHAR(45),
          distance_from_institution DOUBLE PRECISION,
          face_match_score DOUBLE PRECISION,
          liveness_passed BOOLEAN NOT NULL,
          qr_code_verified BOOLEAN,
          browser_fingerprint VARCHAR(255),
          trust_score DOUBLE PRECISION,
          status VARCHAR(20) NOT NULL DEFAULT 'valid',
          flag_reasons JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_logs_teacher_time ON attendance_logs (teacher_id, timestamp)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS attendance_summary (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
          date TIMESTAMP NOT NULL,
          check_in_time TIMESTAMP,
          check_out_time TIMESTAMP,
          teaching_sessions_completed INTEGER DEFAULT 0,
          teaching_minutes_total INTEGER DEFAULT 0,
          teaching_minutes_by_subject JSONB,
          attendance_status VARCHAR(20) NOT NULL,
          late_minutes INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          UNIQUE (teacher_id, institution_id, date)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS leave_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          start_date TIMESTAMP NOT NULL,
          end_date TIMESTAMP NOT NULL,
          reason VARCHAR NOT NULL,
          attachment_url VARCHAR,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          approved_by UUID REFERENCES users(id),
          approved_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_teacher ON leave_requests (teacher_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_institution ON leave_requests (institution_id)`);
    } catch (err) {
      console.error('Failed to create TAMS attendance tables:', err);
    }

    // 34. Create teacher_institution_assignments table (NEW - for attendance API)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS teacher_institution_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
          subject_ids JSONB DEFAULT '[]'::jsonb,
          weekly_schedule JSONB,
          status VARCHAR(20) NOT NULL DEFAULT 'aktif',
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_teacher_institution_assignments_teacher ON teacher_institution_assignments (teacher_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_teacher_institution_assignments_institution ON teacher_institution_assignments (institution_id)`);
      console.log('teacher_institution_assignments table created/verified');
    } catch (err) {
      console.error('Failed to create teacher_institution_assignments table:', err);
    }

    // 34b. Create attendance_insights table (used by /api/attendance/insight)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS attendance_insights (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL,
          institution_id INTEGER NOT NULL,
          period_type VARCHAR(10) NOT NULL,
          period_start TIMESTAMP NOT NULL,
          period_end TIMESTAMP NOT NULL,
          insight_data JSONB,
          teaching_minutes_total INTEGER DEFAULT 0,
          teaching_sessions_completed INTEGER DEFAULT 0,
          attendance_days INTEGER DEFAULT 0,
          late_days INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          UNIQUE (teacher_id, institution_id, period_type, period_start)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_insights_teacher ON attendance_insights (teacher_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_insights_institution ON attendance_insights (institution_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_insights_period ON attendance_insights (period_start)`);
      console.log('attendance_insights table created/verified');
    } catch (err) {
      console.error('Failed to create attendance_insights table:', err);
    }

    // 34. Performance Indexes for Foreign Keys (Audit Fix)
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_schedules_lookup ON schedules(school_id, class_id, subject_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_student_attendance_lookup ON student_attendance(schedule_id, student_id, tanggal)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_teacher_journals_lookup ON teacher_journals(school_id, class_id, subject_id, teacher_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_assessments_lookup ON assessments(school_id, class_id, subject_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_student_grades_lookup ON student_grades(assessment_id, student_id)');
    } catch (err) {
      console.error('Failed to create performance indexes:', err);
    }

    // 35. Create user_face_enrollment table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_face_enrollment (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          face_image_1 TEXT,
          face_image_2 TEXT,
          face_image_3 TEXT,
          face_image_4 TEXT,
          face_image_5 TEXT,
          face_descriptor JSONB,
          is_enrolled BOOLEAN NOT NULL DEFAULT false,
          enrolled_at TIMESTAMP,
          pdp_consent_given BOOLEAN NOT NULL DEFAULT false,
          pdp_consent_version VARCHAR(50),
          pdp_consent_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_face_enrollment_user ON user_face_enrollment (user_id)`);
    } catch (err) {
      console.error('Failed to create user_face_enrollment table:', err);
    }

    // 35b. Add face_descriptor column if not exists (for existing tables)
    try {
      const colCheck = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'user_face_enrollment' AND column_name = 'face_descriptor'
      `);
      if (colCheck.rows.length === 0) {
        await pool.query(`
          ALTER TABLE user_face_enrollment ADD COLUMN face_descriptor JSONB
        `);
        console.log('Added face_descriptor column to user_face_enrollment');
      }
    } catch (err) {
      console.error('Failed to add face_descriptor column:', err);
    }

    // 36b. Sprint 2.2 — Morning Briefing (cron terpisah, read-only ke data eksisting)
    // Tabel BARU: preferensi on/off di users + hasil briefing harian per guru.
    // Tidak mengubah tabel schedules/teacher_journals/student_grades/guru_administrasi/attendance_insights.
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS morning_briefing_enabled BOOLEAN NOT NULL DEFAULT TRUE');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS morning_briefings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          briefing_date DATE NOT NULL,
          jadwal JSONB DEFAULT '[]'::jsonb,
          materi_tertinggal JSONB DEFAULT '[]'::jsonb,
          tugas_belum_dikoreksi INTEGER NOT NULL DEFAULT 0,
          siswa_perhatian JSONB DEFAULT '[]'::jsonb,
          dismissed BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (teacher_id, briefing_date)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_morning_briefings_teacher ON morning_briefings (teacher_id, briefing_date)');
    } catch (err) {
      console.error('Failed to create morning_briefings table:', err);
    }

    // 36d. Sprint 3.1 — Approval RPP/Modul Ajar (opsional per institusi)
    // Kolom BARU dengan default, tidak mengubah alur generate-dan-pakai yang sudah jalan.
    // Guru eksisting tetap bisa pakai langsung (status default 'draft').
    try {
      await pool.query(`ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'draft'`);
      await pool.query(`ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS approval_note TEXT`);
      await pool.query(`ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS approved_by UUID`);
      await pool.query(`ALTER TABLE guru_administrasi ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
      // Constraint nilai approval_status
      try {
        await pool.query(`ALTER TABLE guru_administrasi DROP CONSTRAINT IF EXISTS guru_administrasi_approval_status_check`);
        await pool.query(`ALTER TABLE guru_administrasi ADD CONSTRAINT guru_administrasi_approval_status_check CHECK (approval_status IN ('draft','pending','approved','revisi'))`);
      } catch (_) {}
    } catch (err) {
      console.error('Failed to add approval columns to guru_administrasi:', err);
    }
    // 36c. Sprint 2.1 — Weekly Recap Personal (cron terpisah, read-only ke data eksisting)
    // Tabel BARU: preferensi on/off di users + hasil recap mingguan per guru.
    // Tidak mengubah teacher_journals/student_grades/guru_administrasi yang sudah berjalan.
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_recap_enabled BOOLEAN NOT NULL DEFAULT TRUE');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS weekly_recaps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          week_start DATE NOT NULL,
          week_end DATE NOT NULL,
          sesi_mengajar INTEGER NOT NULL DEFAULT 0,
          siswa_remedial_selesai INTEGER NOT NULL DEFAULT 0,
          progress_kurikulum JSONB DEFAULT '[]'::jsonb,
          sent_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (teacher_id, week_start)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_weekly_recaps_teacher ON weekly_recaps (teacher_id, week_start)');
    } catch (err) {
      console.error('Failed to create weekly_recaps table:', err);
    }

    // 36e. Sprint 3.2 — Cache agregasi TPG lintas institusi (1 jam)
    // Tabel BARU, tidak mengubah endpoint tpg-reports yang sudah berjalan.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tpg_cross_institution_cache (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          period_type VARCHAR(10) NOT NULL,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          payload JSONB NOT NULL,
          cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (teacher_id, period_type, period_start)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_tpg_cache_teacher ON tpg_cross_institution_cache (teacher_id, period_type, period_start)');
    } catch (err) {
      console.error('Failed to create tpg_cross_institution_cache table:', err);
    }

    // 36f. Sprint 3.3 — Cache dashboard eksekutif Kepsek/Wakasek (refresh cron 15-30 mnt)
    // Tabel BARU, dipakai agar banyak Kepsek akses bersamaan tanpa beban DB produksi.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS executive_dashboard_cache (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
          week_start DATE NOT NULL,
          payload JSONB NOT NULL,
          cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (institution_id, week_start)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_exec_dashboard_cache ON executive_dashboard_cache (institution_id, week_start)');
    } catch (err) {
      console.error('Failed to create executive_dashboard_cache table:', err);
    }

    // 36g. Sprint 4.4 — Well-Being Check-In (independen, agregasi ANONIM)
    // Tabel BARU, tidak menyentuh sistem lama. Tidak ada kolom user_id di agregat.
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS well_being_checkins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          institution_id INTEGER REFERENCES institutions(id) ON DELETE SET NULL,
          beban_kerja INTEGER NOT NULL CHECK (beban_kerja BETWEEN 1 AND 5),
          dukungan INTEGER NOT NULL CHECK (dukungan BETWEEN 1 AND 5),
          minggu_ke DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (teacher_id, minggu_ke)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_well_being_teacher ON well_being_checkins (teacher_id, minggu_ke)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_well_being_inst ON well_being_checkins (institution_id, minggu_ke)');

      // 36h. Sprint 4.6 — Forum/Komunitas Guru (per-mapel, privat per-institusi)
      // Tabel BARU, independen. Topik dibatasi per mapel, akses hanya anggota institusi yg sama.
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS forum_topics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
            mapel VARCHAR(100) NOT NULL,
            author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_forum_topics_inst_mapel ON forum_topics (institution_id, mapel)');

        await pool.query(`
          CREATE TABLE IF NOT EXISTS forum_replies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            topic_id UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
            author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_forum_replies_topic ON forum_replies (topic_id)');
      } catch (err) {
        console.error('Failed to create forum tables:', err);
      }

      // Agregat anonim per institusi per minggu (tanpa data individual)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS well_being_weekly_summary (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
          minggu_ke DATE NOT NULL,
          total_responden INTEGER NOT NULL DEFAULT 0,
          rata_beban_kerja NUMERIC(3,2) NOT NULL DEFAULT 0,
          rata_dukungan NUMERIC(3,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (institution_id, minggu_ke)
        )
      `);
    } catch (err) {
      console.error('Failed to create well_being tables:', err);
    }

    // 36. Conditional Foreign Key for guru_administrasi (Audit Fix)
    try {
      const checkInstTable = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'institutions')"
      );
      if (checkInstTable.rows[0].exists) {
        await pool.query(`
          ALTER TABLE guru_administrasi
          ADD CONSTRAINT fk_guru_administrasi_institution
          FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
        `);
      }
    } catch { /* constraint might already exist */ }

    console.log("SaaS Academic & TAMS tables checked/initialized successfully");
  } catch (err) {
    console.error("Failed to initialize SaaS Academic & TAMS tables:", err);
  }
};

export async function requireActiveTahunAjaran(): Promise<{ id: string; nama: string }> {
  const result = await pool.query(
    `SELECT id, nama FROM tahun_ajaran WHERE is_active = true LIMIT 1`
  )
  if (result.rows.length === 0) {
    throw new Error('Tidak ada tahun ajaran yang aktif. Silakan buat dan aktivasi tahun ajaran terlebih dahulu.')
  }
  return result.rows[0]
}

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

export interface UserRecord {
  id: string;
  email: string;
  nama_lengkap: string;
  whatsapp?: string;
  phone?: string;
  username?: string;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  try {
    const result = await pool.query(
      `SELECT id, email, nama_lengkap, whatsapp, phone, username
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as UserRecord;
  } catch (err) {
    console.error("Failed to get user by ID:", err);
    return null;
  }
}

// Lazy initialization - hanya dipanggil ketika benar-benar dibutuhkan
// BUKAN di module scope
export function ensureDbInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initDb().catch((err) => {
      console.error("[DB] Initialization failed:", err);
      initPromise = null; // Reset agar bisa retry
      throw err;
    });
    if (process.env.NODE_ENV !== 'production') {
      globalForInit.initPromise = initPromise;
    }
  }
  return initPromise;
}

// TIDAK ADA pemanggilan ensureDbInitialized() di module scope
// Ini yang menyebabkan multiple initialization sebelumnya
