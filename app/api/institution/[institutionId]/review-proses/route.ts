import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';

// =====================================================
// Review Proses Mengajar Guru (spec §1.3)
// GET ?
//   list=true & institutionId=…         → ringkasan semua guru
//   guruId=… & institutionId=…          → profil proses mengajar 1 guru
// POST (JSON)                           → kirim feedback KS → guru (ks_feedback)
// =====================================================

const LEADER_ROLES = ['kepala_sekolah', 'wakasek'];

async function checkLeader(institutionId: number, appUserId: string): Promise<void> {
  const memberRes = await query(
    `SELECT imr.value AS role
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
       AND imr.value = ANY($3::text[])`,
    [appUserId, institutionId, LEADER_ROLES]
  );
  if (memberRes.rows.length === 0) {
    throw new Error('Forbidden');
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const institutionId = searchParams.get('institutionId');
    const guruId = searchParams.get('guruId');

    if (!institutionId) {
      return NextResponse.json({ error: 'institutionId wajib' }, { status: 400 });
    }
    const instId = parseInt(institutionId, 10);

    try {
      await checkLeader(instId, session.id);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Ringkasan semua guru ──
    const guruRes = await query(
      `SELECT im.app_user_id::text AS guru_id,
              u.nama_lengkap AS guru_nama,
              u.email AS guru_email,
              COALESCE((SELECT COUNT(*)::int FROM guru_administrasi ga
                        WHERE ga.user_id::text = im.app_user_id
                          AND ga.institution_id = $1
                          AND ga.tipe_dokumen IN ('rpp','modul')), 0) AS total_rpp,
              COALESCE((SELECT COUNT(*)::int FROM guru_administrasi ga
                        WHERE ga.user_id::text = im.app_user_id
                          AND ga.institution_id = $1
                          AND ga.tipe_dokumen IN ('rpp','modul')
                          AND ga.approval_status = 'approved'), 0) AS rpp_approved,
              COALESCE((SELECT COUNT(*)::int FROM teacher_journals tj
                        WHERE tj.user_id::text = im.app_user_id
                          AND tj.institution_id = $1), 0) AS total_jurnal,
              COALESCE((SELECT COUNT(*)::int FROM guru_observasi go
                        WHERE go.guru_id = im.app_user_id AND go.institution_id = $1), 0) AS total_observasi,
              COALESCE((SELECT COUNT(*)::int FROM ks_feedback kf
                        WHERE kf.guru_id = im.app_user_id AND kf.institution_id = $1), 0) AS total_feedback
       FROM public.institution_members im
       JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active'
         AND EXISTS (SELECT 1 FROM public.institution_members_role imr
                     WHERE imr.parent_id = im.id AND imr.value = 'guru')
       ORDER BY u.nama_lengkap`,
      [instId]
    );

    if (!guruId) {
      const rows = (guruRes.rows as any[]).map((g) => {
        const jurnal = g.total_jurnal || 0;
        const rpp = g.total_rpp || 0;
        const realisasi = Math.round((jurnal / Math.max(1, rpp * 6)) * 100); // target 6 jurnal per RPP
        return {
          guruId: g.guru_id,
          guruNama: g.guru_nama,
          guruEmail: g.guru_email,
          totalRpp: rpp,
          rppApproved: g.rpp_approved,
          totalJurnal: jurnal,
          totalObservasi: g.total_observasi,
          totalFeedback: g.total_feedback,
          realisasi: Math.min(100, realisasi),
        };
      });
      return NextResponse.json({ guru: rows });
    }

    // ── Profil satu guru ──
    const guruRow = guruRes.rows.find((r: any) => String(r.guru_id) === String(guruId));
    if (!guruRow) {
      return NextResponse.json({ error: 'Guru tidak ditemukan di institusi ini' }, { status: 404 });
    }

    const [rppRes, jurnalRes, observasiRes, feedbackRes] = await Promise.all([
      query(
        `SELECT id, judul_dokumen, tipe_dokumen, approval_status, tanggal_kegiatan
         FROM guru_administrasi
         WHERE user_id::text = $1 AND institution_id = $2 AND tipe_dokumen IN ('rpp','modul')
         ORDER BY tanggal_kegiatan DESC NULLS LAST, created_at DESC LIMIT 20`,
        [guruId, instId]
      ),
      query(
        `SELECT tanggal, kelas, mapel, materi_pembelajaran, status, created_at
         FROM teacher_journals
         WHERE user_id::text = $1 AND institution_id = $2
         ORDER BY tanggal DESC, created_at DESC LIMIT 30`,
        [guruId, instId]
      ),
      query(
        `SELECT go.id, go.tanggal, go.skor, go.aspek, go.catatan, go.observer
         FROM guru_observasi go
         WHERE go.guru_id = $1 AND go.institution_id = $2
         ORDER BY go.tanggal DESC LIMIT 20`,
        [guruId, instId]
      ),
      query(
        `SELECT kf.id, kf.tanggal, kf.jenis, kf.judul, kf.isi, kf.ks_nama, kf.is_read
         FROM ks_feedback kf
         WHERE kf.guru_id = $1 AND kf.institution_id = $2
         ORDER BY kf.tanggal DESC, kf.created_at DESC LIMIT 20`,
        [guruId, instId]
      ),
    ]);

    return NextResponse.json({
      guru: {
        guruId: guruRow.guru_id,
        guruNama: guruRow.guru_nama,
        guruEmail: guruRow.guru_email,
        totalRpp: guruRow.total_rpp,
        rppApproved: guruRow.rpp_approved,
        totalJurnal: guruRow.total_jurnal,
      },
      rpp: rppRes.rows,
      jurnal: jurnalRes.rows,
      observasi: observasiRes.rows,
      feedback: feedbackRes.rows,
    });
  } catch (err: any) {
    console.error('GET review-proses error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const { institutionId, guruId, judul, isi, jenis } = body;

    if (!institutionId || !guruId || !judul || !isi) {
      return NextResponse.json(
        { error: 'institutionId, guruId, judul, dan isi wajib' },
        { status: 400 }
      );
    }
    const instId = parseInt(institutionId, 10);

    try {
      await checkLeader(instId, session.id);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Nama lengkap pengirim
    const ksRes = await query(`SELECT nama_lengkap FROM users WHERE id = $1`, [session.id]);
    const ksNama = ksRes.rows[0]?.nama_lengkap || 'Kepala Sekolah';

    // Nama guru
    const guruRes = await query(
      `SELECT u.nama_lengkap FROM users u
       JOIN public.institution_members im ON im.app_user_id = u.id::text
       WHERE u.id::text = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [guruId, instId]
    );
    const guruNama = guruRes.rows[0]?.nama_lengkap || 'Guru';

    const result = await query(
      `INSERT INTO ks_feedback
         (institution_id, guru_id, guru_nama, ks_id, ks_nama, tanggal, jenis, judul, isi, is_read)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, false)
       RETURNING id, tanggal, jenis, judul, isi`,
      [instId, guruId, guruNama, session.id, ksNama, jenis || 'feedback', judul, isi]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: any) {
    console.error('POST review-proses error:', err);
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}