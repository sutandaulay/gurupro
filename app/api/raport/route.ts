import { NextResponse } from 'next/server';
import { query, logAudit } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const siswaId = searchParams.get('siswa_id');
    const kelasId = searchParams.get('kelas_id');
    const periode = searchParams.get('periode');
    const status = searchParams.get('status');

    let sql = `
      SELECT dr.*,
             s.nama_siswa, s.nisn, s.nis_lokal,
             c.nama_kelas,
             tr.nama_template, tr.mode_nilai_akademik
      FROM data_raport dr
      JOIN students s ON s.id = dr.siswa_id
      JOIN classes c ON c.id = dr.kelas_id
      JOIN template_raport tr ON tr.id = dr.template_raport_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (siswaId) {
      sql += ` AND dr.siswa_id = $${paramIdx++}`;
      params.push(siswaId);
    }
    if (kelasId) {
      sql += ` AND dr.kelas_id = $${paramIdx++}`;
      params.push(kelasId);
    }
    if (periode) {
      sql += ` AND dr.periode = $${paramIdx++}`;
      params.push(periode);
    }
    if (status) {
      sql += ` AND dr.status = $${paramIdx++}`;
      params.push(status);
    }

    sql += ' ORDER BY dr.created_at DESC';

    const res = await query(sql, params);
    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error('GET data_raport error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const body = await req.json();
    const { siswa_id, nisn, nis_lokal, kelas_id, template_raport_id, periode, jenis_laporan } = body;

    if (!siswa_id || !nisn || !kelas_id || !template_raport_id || !periode || !jenis_laporan) {
      return NextResponse.json({
        error: 'siswa_id, nisn, kelas_id, template_raport_id, periode, dan jenis_laporan wajib diisi'
      }, { status: 400 });
    }

    const existRes = await query(
      `SELECT id FROM data_raport WHERE siswa_id = $1 AND template_raport_id = $2 AND periode = $3`,
      [siswa_id, template_raport_id, periode]
    );

    if (existRes.rows.length > 0) {
      return NextResponse.json({ error: 'Raport sudah ada' }, { status: 409 });
    }

    const res = await query(
      `INSERT INTO data_raport (siswa_id, nisn, nis_lokal, kelas_id, template_raport_id, periode, jenis_laporan)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [siswa_id, nisn, nis_lokal || '', kelas_id, template_raport_id, periode, jenis_laporan]
    );

    const raportId = res.rows[0].id;

    await query(
      `INSERT INTO data_raport_status_history (data_raport_id, status, changed_by)
       VALUES ($1, 'draft', $2)`,
      [raportId, userId]
    );

    await logAudit(userId, 'CREATE_RAPORT', `Membuat raport baru: ${raportId}`);

    return NextResponse.json({ success: true, id: raportId });
  } catch (error: any) {
    console.error('POST data_raport error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
