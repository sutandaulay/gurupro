import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { requireSchoolAccess } from '@/lib/school-access';
import { parsePagination, offset, wrapResponse } from '@/lib/pagination';

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('school_id');
    const kelasId = searchParams.get('kelas_id');
    const pag = parsePagination(searchParams);

    if (schoolId) await requireSchoolAccess(schoolId)

    if (!kelasId) {
      return NextResponse.json({ error: 'kelas_id wajib diisi' }, { status: 400 });
    }

    if (!isValidUUID(kelasId)) {
      return NextResponse.json({ error: 'kelas_id harus UUID yang valid' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    let session;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ error: 'Session tidak valid' }, { status: 401 });
    }

    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'data_raport'
      ) as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ error: 'Tabel data_raport belum ada' }, { status: 500 });
    }

    const countRes = await query(
      `SELECT COUNT(*)::int as total
       FROM data_raport dr
       WHERE dr.kelas_id = $1`,
      [kelasId]
    );
    const total = countRes.rows[0].total;

    const raportRes = await query(
      `SELECT dr.id, dr.siswa_id, dr.nisn, dr.kelas_id, dr.periode, dr.jenis_laporan, dr.status,
              tr.nama_template, tr.mode_nilai_akademik, tr.basis_deskripsi, tr.kurikulum,
              s.nama_siswa, c.nama_kelas
       FROM data_raport dr
       JOIN template_raport tr ON tr.id = dr.template_raport_id
       JOIN students s ON s.id = dr.siswa_id
       JOIN classes c ON c.id = dr.kelas_id
       WHERE dr.kelas_id = $1
       ORDER BY s.nama_siswa ASC
       LIMIT $2 OFFSET $3`,
      [kelasId, pag.limit, offset(pag)]
    );

    const raportIds = raportRes.rows.map(r => r.id);

    const allNilaiRes = raportIds.length > 0 ? await query(
      `SELECT dnrm.*, sb.nama_mapel,
              im.app_user_id as guru_user_id,
              u.nama_lengkap as guru_nama
       FROM data_raport_nilai_mapel dnrm
       LEFT JOIN subjects sb ON sb.id = dnrm.mapel_id
        LEFT JOIN institution_members im ON im.app_user_id::uuid = dnrm.guru_mapel_member_id
        LEFT JOIN users u ON u.id = im.app_user_id::uuid
       WHERE dnrm.data_raport_id = ANY($1::uuid[])
       ORDER BY dnrm.data_raport_id, sb.nama_mapel ASC`,
      [raportIds]
    ) : { rows: [] };

    const nilaiByRaportId = new Map();
    for (const row of allNilaiRes.rows) {
      const list = nilaiByRaportId.get(row.data_raport_id);
      if (list) { list.push(row); } else { nilaiByRaportId.set(row.data_raport_id, [row]); }
    }

    const raports = raportRes.rows.map(raport => ({
      ...raport,
      nilai_mapel: nilaiByRaportId.get(raport.id) || [],
    }));

    return NextResponse.json(wrapResponse(raports, total, pag));
  } catch (error: any) {
    console.error('GET review raport error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
