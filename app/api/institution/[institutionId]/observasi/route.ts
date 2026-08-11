import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';
import { parsePagination, wrapResponse } from '@/lib/pagination';

// =====================================================
// GET  — list observasi (oleh KS/Wakasek)
// POST — buat observasi kelas
// =====================================================

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const institutionId = searchParams.get('institutionId');
    const guruId = searchParams.get('guruId');
    const tanggal = searchParams.get('tanggal');

    if (!institutionId) {
      return NextResponse.json({ error: 'institutionId wajib' }, { status: 400 });
    }

    const instId = parseInt(institutionId, 10);

    // RBAC: hanya kepala_sekolah / wakasek / operator
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

    let whereClause = 'go.institution_id = $1';
    const params: any[] = [instId];
    let idx = 2;

    if (guruId) {
      whereClause += ` AND go.guru_id = $${idx++}`;
      params.push(guruId);
    }
    if (tanggal) {
      whereClause += ` AND go.tanggal = $${idx++}`;
      params.push(tanggal);
    }

    const countRes = await query(
      `SELECT COUNT(*)::int FROM guru_observasi go WHERE ${whereClause}`,
      params
    );
    const pagination = parsePagination(searchParams);
    const offset = (pagination.page - 1) * pagination.limit;
    params.push(pagination.limit, offset);

    const result = await query(
      `SELECT go.*,
              u.nama_lengkap AS guru_nama,
              obs.nama_lengkap AS observer_nama
       FROM guru_observasi go
       LEFT JOIN users u ON u.id::text = go.guru_id
       LEFT JOIN users obs ON obs.id::text = go.observer_id
       WHERE ${whereClause}
       ORDER BY go.tanggal DESC, go.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return NextResponse.json(wrapResponse(result.rows, countRes.rows[0].count, pagination));
  } catch (err) {
    console.error('GET /api/institution/observasi error:', err);
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
      skor,
      aspek,
      catatan,
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

    // Get observer nama
    const obsRes = await query(
      `SELECT nama_lengkap FROM users WHERE id = $1`,
      [session.id]
    );
    const observerNama = obsRes.rows[0]?.nama_lengkap || session.nama || 'KS';

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
      `INSERT INTO guru_observasi
         (institution_id, guru_id, guru_nama, observer_id, observer, tanggal, skor, aspek, catatan, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'done')
       RETURNING *`,
      [
        instId,
        guruId,
        finalGuruNama,
        session.id,
        observerNama,
        tanggal,
        skor || null,
        aspek || 'kelas',
        catatan || null,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/institution/observasi error:', err);
    return NextResponse.json({ error: 'Failed to create observasi' }, { status: 500 });
  }
}
