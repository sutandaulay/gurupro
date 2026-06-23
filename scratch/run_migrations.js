const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'gurupro_db',
  password: 'nus4nt4r4',
  port: 5432,
});

const sqlQueries = [
  // 11. Tabel Guru Administrasi (Dokumen RPP, Silabus, ATP, Prota, Promes)
  `CREATE TABLE IF NOT EXISTS guru_administrasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipe_dokumen VARCHAR(50) NOT NULL,
    judul_dokumen VARCHAR(255) NOT NULL,
    konten JSONB NOT NULL,
    tanggal_kegiatan DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 12. Tabel Academic Calendars
  `CREATE TABLE IF NOT EXISTS academic_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 13. Tabel Assessments (Evaluasi Nilai & KKM)
  `CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    nama_asesmen VARCHAR(255) NOT NULL,
    tipe_asesmen VARCHAR(50) NOT NULL, -- 'Diagnostik', 'Formatif', 'Sumatif'
    kkm INTEGER NOT NULL DEFAULT 70,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 14. Tabel Student Grades (Buku Nilai & Remedial Tracker)
  `CREATE TABLE IF NOT EXISTS student_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    nilai_awal NUMERIC(5,2) NOT NULL,
    nilai_remedial NUMERIC(5,2),
    nilai_akhir NUMERIC(5,2) NOT NULL,
    status_remedial VARCHAR(50) NOT NULL DEFAULT 'Lulus', -- 'Lulus', 'Butuh Remedial', 'Remedial Selesai'
    catatan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 15. Tabel Audit Trails (Jejak Log Audit)
  `CREATE TABLE IF NOT EXISTS audit_trails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    aksi VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`
];

async function run() {
  try {
    for (const sql of sqlQueries) {
      await pool.query(sql);
    }
    console.log("TAMS local database tables created successfully!");
  } catch (err) {
    console.error("Migration error:", err.message);
  } finally {
    await pool.end();
  }
}

run();
