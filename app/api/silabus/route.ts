import { query } from '@/lib/db';
import { parseSessionCookie } from '@/lib/session-sign';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ============================================
// SILABUS LIST API
// Get all Silabus documents for current user/school
// ============================================

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const userId = session.id;

    const { searchParams } = new URL(req.url);
    const school_id = searchParams.get('school_id');
    const subject_id = searchParams.get('subject_id');
    const jenjang = searchParams.get('jenjang');
    const semester = searchParams.get('semester');

    let whereClauses = ['ga.user_id = $1', "ga.tipe_dokumen = 'silabus'"];
    let params: any[] = [userId];
    let paramIdx = 2;

    if (school_id) {
      whereClauses.push(`ga.school_id = $${paramIdx++}`);
      params.push(school_id);
    }
    if (subject_id) {
      whereClauses.push(`ga.subject_id = $${paramIdx++}`);
      params.push(subject_id);
    }
    if (jenjang) {
      whereClauses.push(`ga.jenjang = $${paramIdx++}`);
      params.push(jenjang);
    }
    if (semester) {
      whereClauses.push(`ga.semester = $${paramIdx++}`);
      params.push(parseInt(semester));
    }

    const whereSQL = whereClauses.join(' AND ');

    const result = await query(
      `
      SELECT
        ga.id,
        ga.judul_dokumen,
        ga.konten,
        ga.tanggal_kegiatan,
        ga.kurikulum,
        ga.jenjang,
        ga.fase,
        ga.semester,
        ga.dimensi8,
        ga.school_id,
        ga.subject_id,
        ga.tahunAjaran,
        ga.created_at,
        s.nama_sekolah,
        sub.nama_mapel
      FROM guru_administrasi ga
      LEFT JOIN schools s ON s.id = ga.school_id
      LEFT JOIN subjects sub ON sub.id = ga.subject_id
      WHERE ${whereSQL}
      ORDER BY ga.created_at DESC
    `,
      params
    );

    // Parse konten JSON
    const parsedData = result.rows.map((row) => ({
      ...row,
      konten: typeof row.konten === 'string' ? JSON.parse(row.konten) : row.konten,
    }));

    return NextResponse.json({ data: parsedData, count: result.rows.length });
  } catch (error: any) {
    console.error('Silabus List Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// SILABUS CREATE/UPDATE API
// ==========================================

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const userId = session.id;

    const body = await req.json();
    const {
      judul_dokumen,
      konten,
      school_id,
      subject_id,
      jenjang,
      kurikulum,
      fase,
      semester,
      dimensi8 = [],
      tahunAjaran,
    } = body;

    if (!judul_dokumen || !konten) {
      return NextResponse.json({ error: 'Judul dan konten wajib diisi' }, { status: 400 });
    }

    const result = await query(
      `
      INSERT INTO guru_administrasi (
        user_id, tipe_dokumen, judul_dokumen, konten,
        school_id, subject_id, jenjang, kurikulum, fase, semester,
        dimensi8, tahunAjaran
      ) VALUES ($1, 'silabus', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, judul_dokumen, created_at
    `,
      [
        userId,
        judul_dokumen,
        JSON.stringify(konten),
        school_id || null,
        subject_id || null,
        jenjang || null,
        kurikulum || null,
        fase || null,
        semester || null,
        dimensi8,
        tahunAjaran || null,
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Silabus Create Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// SILABUS DELETE API
// ==========================================

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const userId = session.id;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID dokumen wajib diisi' }, { status: 400 });
    }

    // Verify ownership
    const checkResult = await query(
      "SELECT id FROM guru_administrasi WHERE id = $1 AND user_id = $2 AND tipe_dokumen = 'silabus'",
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan atau bukan milik Anda' }, { status: 404 });
    }

    await query('DELETE FROM guru_administrasi WHERE id = $1', [id]);

    return NextResponse.json({ success: true, message: 'Dokumen berhasil dihapus' });
  } catch (error: any) {
    console.error('Silabus Delete Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
