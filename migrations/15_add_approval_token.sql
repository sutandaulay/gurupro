-- Migration: Buat tabel school_registrations + kolom approval_token untuk self-service approval
CREATE TABLE IF NOT EXISTS school_registrations (
  id SERIAL PRIMARY KEY,
  nama_lembaga VARCHAR(255) NOT NULL,
  npsn VARCHAR(50),
  jenjang VARCHAR(100) NOT NULL,
  naungan VARCHAR(100) NOT NULL,
  alamat TEXT,
  nama_kepala_sekolah VARCHAR(255),
  email_kontak VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  catatan_admin TEXT,
  approval_token TEXT,
  approval_token_expires TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_school_reg_status ON school_registrations(status);
CREATE INDEX IF NOT EXISTS idx_school_reg_approval_token ON school_registrations(approval_token);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_reg_email_pending ON school_registrations(LOWER(email_kontak)) WHERE status = 'pending';
