import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// =====================================================
// POST — auto-create guru_observasi + ks_feedback tables
// Dipanggil sekali saat app startup atau via setup script.
// =====================================================

export async function POST(_req: Request) {
  try {
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                      WHERE table_schema = 'public' AND table_name = 'guru_observasi') THEN
          CREATE TABLE guru_observasi (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            institution_id INTEGER NOT NULL,
            guru_id VARCHAR(255) NOT NULL,
            guru_nama VARCHAR(255),
            observer_id VARCHAR(255) NOT NULL,
            observer VARCHAR(255),
            tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
            skor DECIMAL(5,2) CHECK (skor >= 0 AND skor <= 100),
            aspek VARCHAR(100) DEFAULT 'kelas',
            catatan TEXT,
            status VARCHAR(50) DEFAULT 'done',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX idx_guru_observasi_institution ON guru_observasi(institution_id);
          CREATE INDEX idx_guru_observasi_guru ON guru_observasi(guru_id);
          CREATE INDEX idx_guru_observasi_tanggal ON guru_observasi(tanggal DESC);
        END IF;
      END $$;
    `);

    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                      WHERE table_schema = 'public' AND table_name = 'ks_feedback') THEN
          CREATE TABLE ks_feedback (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            institution_id INTEGER NOT NULL,
            guru_id VARCHAR(255) NOT NULL,
            guru_nama VARCHAR(255),
            ks_id VARCHAR(255) NOT NULL,
            ks_nama VARCHAR(255),
            tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
            jenis VARCHAR(50) DEFAULT 'proses',
            judul VARCHAR(255),
            isi TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX idx_ks_feedback_institution ON ks_feedback(institution_id);
          CREATE INDEX idx_ks_feedback_guru ON ks_feedback(guru_id);
          CREATE INDEX idx_ks_feedback_ks ON ks_feedback(ks_id);
        END IF;
      END $$;
    `);

    return NextResponse.json({ ok: true, message: 'Tables created' });
  } catch (err) {
    console.error('POST /api/setup/tables error:', err);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
