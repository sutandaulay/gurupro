import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const kelasId = searchParams.get('kelas_id');
    const siswaId = searchParams.get('siswa_id');
    const status = searchParams.get('status');
    const periode = searchParams.get('periode');
    const includeHistory = searchParams.get('include_history') === 'true';

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

    // Check if tables exist
    const tableCheck = await query(`
      SELECT
        EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_raport') as raport_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'template_raport') as template_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') as students_exists,
        EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'classes') as classes_exists
    `);

    const { raport_exists, template_exists, students_exists, classes_exists } = tableCheck.rows[0];

    if (!raport_exists || !template_exists || !students_exists || !classes_exists) {
      return NextResponse.json({
        error: 'Tabel raport belum lengkap',
        details: { raport_exists, template_exists, students_exists, classes_exists }
      }, { status: 500 });
    }

    let sql = `
      SELECT dr.id, dr.siswa_id, dr.nisn, dr.nis_lokal, dr.kelas_id, dr.periode,
             dr.jenis_laporan, dr.status, dr.sikap_id, dr.catatan_wali_kelas,
             dr.presensi_snapshot, dr.created_at, dr.updated_at,
             s.nama_siswa, c.nama_kelas,
             tr.nama_template, tr.mode_nilai_akademik
      FROM data_raport dr
      JOIN students s ON s.id = dr.siswa_id
      JOIN classes c ON c.id = dr.kelas_id
      JOIN template_raport tr ON tr.id = dr.template_raport_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (kelasId) {
      if (!isValidUUID(kelasId)) {
        return NextResponse.json({ error: 'kelas_id harus UUID yang valid' }, { status: 400 });
      }
      sql += ` AND dr.kelas_id = $${paramIdx++}`;
      params.push(kelasId);
    }
    if (siswaId) {
      if (!isValidUUID(siswaId)) {
        return NextResponse.json({ error: 'siswa_id harus UUID yang valid' }, { status: 400 });
      }
      sql += ` AND dr.siswa_id = $${paramIdx++}`;
      params.push(siswaId);
    }
    if (status) {
      sql += ` AND dr.status = $${paramIdx++}`;
      params.push(status);
    }
    if (periode) {
      sql += ` AND dr.periode = $${paramIdx++}`;
      params.push(periode);
    }

    sql += ' ORDER BY c.nama_kelas, s.nama_siswa ASC';

    const res = await query(sql, params);

    let results = res.rows;

    // If include_history is requested, fetch status history for each raport
    if (includeHistory && results.length > 0) {
      const raportIds = results.map(r => r.id);

      // Check if history table exists
      const historyTableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'data_raport_status_history'
        ) as exists
      `);

      if (historyTableCheck.rows[0]?.exists) {
        const historyRes = await query(
          `SELECT h.data_raport_id, h.status, h.changed_at, h.changed_by, h.changed_by_role,
                  u.nama_lengkap as changed_by_nama
           FROM data_raport_status_history h
           LEFT JOIN users u ON u.id = h.changed_by
           WHERE h.data_raport_id = ANY($1)
           ORDER BY h.changed_at ASC`,
          [raportIds]
        );

        const historyByRaport: Record<string, any[]> = {};
        for (const h of historyRes.rows) {
          if (!historyByRaport[h.data_raport_id]) {
            historyByRaport[h.data_raport_id] = [];
          }
          historyByRaport[h.data_raport_id].push({
            status: h.status,
            changed_at: h.changed_at,
            changed_by: h.changed_by,
            changed_by_role: h.changed_by_role,
            changed_by_nama: h.changed_by_nama,
          });
        }

        results = results.map(r => ({
          ...r,
          status_history: historyByRaport[r.id] || [],
        }));
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('GET raport status error:', error);
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
    const { data_raport_id, new_status, changed_by_role } = body;

    if (!data_raport_id || !new_status) {
      return NextResponse.json({ error: 'data_raport_id dan new_status wajib diisi' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['draft', 'dikirim_ke_wali_kelas', 'dikonfirmasi', 'difinalisasi', 'siap_print'];
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json({
        error: `Status tidak valid. Pilihan: ${validStatuses.join(', ')}`
      }, { status: 400 });
    }

    // Use the repository function for status transition (single source of truth)
    const result = await ubahStatus(
      data_raport_id,
      new_status as StatusRaport,
      userId,
      changed_by_role as RoleChangedBy
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit(userId, 'CHANGE_RAPORT_STATUS', `Ubah status raport ${data_raport_id} ke ${new_status}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST change_status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
