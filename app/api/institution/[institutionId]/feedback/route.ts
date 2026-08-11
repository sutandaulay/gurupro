import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';
import { parsePagination, wrapResponse } from '@/lib/pagination';

// =====================================================
// GET  — list feedback KS ke guru
// POST — buat feedback
// =====================================================

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const institutionId = searchParams.get('institutionId');
    const guruId = searchParams.get('guruId');
    const isKs = searchParams.get('asKs') === 'true';

    if (!institutionId) {
      return NextResponse.json({ error: 'institutionId wajib' }, { status: 400 });
    }

    const instId = parseInt(institutionId, 10);

    // RBAC: KS / Wakasek bisa lihat semua, guru lihat miliknya sendiri
    const memberRes = await query(
      `SELECT imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         AND imr.value IN ('kepala_sekolah','wakasek','operator','admin_sekolah')`,
      [session.id, instId]
    );

    const isLeader = memberRes.rows.length > 0;

    let whereClause = 'kf.institution_id = $1';
    const params: any[] = [instId];
    let idx = 2;

    if (guruId) {
      whereClause += ` AND kf.guru_id = $${idx++}`;
      params.push(guruId);
    }

    if (!isLeader) {
      // Guru hanya lihat feedback miliknya
      whereClause += ` AND kf.guru_id = $${idx++}`;
      params.push(session.id);
    }

    const countRes = await query(
      `SELECT COUNT(*)::int FROM ks_feedback kf WHERE ${whereClause}`,
      params
    );
    const pagination = parsePagination(searchParams);
    const offset = (pagination.page - 1) * pagination.limit;
    params.push(pagination.limit, offset);

    const result = await query(
      `SELECT kf.*,
              u.nama_lengkap AS guru_nama,
              ks.nama_lengkap AS ks_nama
       FROM ks_feedback kf
       LEFT JOIN users u ON u.id::text = kf.guru_id
       LEFT JOIN users ks ON ks.id::text = kf.ks_id
       WHERE ${whereClause}
       ORDER BY kf.tanggal DESC, kf.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return NextResponse.json(wrapResponse(result.rows, countRes.rows[0].count, pagination));
  } catch (err) {
    console.error('GET /api/institution/feedback error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const {
      institutionId,
      guruId,
      guruNama,
      tanggal,
      jenis,
      judul,
      isi,
    } = body;

    if (!institutionId || !guruId || !tanggal) {
      return NextResponse.json(
        { error: 'institutionId, guruId, dan tanggal wajib' },
        { status: 400 }
      );
    }

    const instId = parseInt(institutionId, 10);

    // RBAC: KS / Wakasek / Operator
    const memberRes = await query(
      `SELECT imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         AND imr.value IN ('kepala_sekolah','wakasek','operator','admin_sekolah')`,
      [session.id, instId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get KS nama
    const ksRes = await query(
      `SELECT nama_lengkap FROM users WHERE id = $1`,
      [session.id]
    );
    const ksNama = ksRes.rows[0]?.nama_lengkap || session.nama || 'KS';

    // Get guru nama
    let finalGuruNama = guruNama || 'Guru';
    const guruRes = await query(
      `SELECT nama_lengkap FROM users WHERE id::text = $1`,
      [guruId]
    );
    if (guruRes.rows.length > 0) {
      finalGuruNama = guruRes.rows[0].nama_lengkap || guruNama || 'Guru';
    }

    const result = await query(
      `INSERT INTO ks_feedback
         (institution_id, guru_id, guru_nama, ks_id, ks_nama, tanggal, jenis, judul, isi)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        instId,
        guruId,
        finalGuruNama,
        session.id,
        ksNama,
        tanggal,
        jenis || 'proses',
        judul || null,
        isi || null,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/institution/feedback error:', err);
    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 });
  }
}

// =====================================================
// PATCH — mark feedback as read
// =====================================================
export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const { feedbackId } = body;

    if (!feedbackId) {
      return NextResponse.json({ error: 'feedbackId wajib' }, { status: 400 });
    }

    const result = await query(
      `UPDATE ks_feedback SET is_read = TRUE, updated_at = NOW()
       WHERE id = $1 AND guru_id = $2
       RETURNING *`,
      [feedbackId, session.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/institution/feedback error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
