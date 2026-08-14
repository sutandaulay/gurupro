import { NextResponse } from 'next/server';
import { query, logAudit } from '@/lib/db';
import { cookies } from 'next/headers';
import { requireSchoolAccess } from '@/lib/school-access';
import { parsePagination, offset, wrapResponse } from '@/lib/pagination';
import { ubahStatus } from '@/lib/raport/repository';
import { getOwnedWaliKelasClassIds } from '@/lib/wali-kelas/dashboard';
import type { StatusRaport, RoleChangedBy } from '@/lib/raport/repository';
import { parseSessionCookie } from '@/lib/session-sign';

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('school_id');
    const kelasId = searchParams.get('kelas_id');
    const siswaId = searchParams.get('siswa_id');
    const status = searchParams.get('status');
    const periode = searchParams.get('periode');
    const includeHistory = searchParams.get('include_history') === 'true';
    const pag = parsePagination(searchParams);

    if (schoolId) await requireSchoolAccess(schoolId)

    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const userId = session.id;

    // RBAC: daftar raport hanya bisa dilihat oleh wali kelas untuk kelas yang
    // menjadi tanggung jawabnya (server-side, bukan klaim client).
    const ownedClassIds = await getOwnedWaliKelasClassIds(userId);
    if (ownedClassIds.length === 0) {
      return NextResponse.json(wrapResponse([], 0, pag));
    }

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

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    // SCOPING: hanya raport kelas yang dimiliki user ini sebagai wali kelas.
    whereClauses.push(`dr.kelas_id = ANY($${paramIdx++}::uuid[])`);
    params.push(ownedClassIds);

    if (kelasId) {
      if (!isValidUUID(kelasId)) {
        return NextResponse.json({ error: 'kelas_id harus UUID yang valid' }, { status: 400 });
      }
      whereClauses.push(`dr.kelas_id = $${paramIdx++}`);
      params.push(kelasId);
    }
    if (siswaId) {
      if (!isValidUUID(siswaId)) {
        return NextResponse.json({ error: 'siswa_id harus UUID yang valid' }, { status: 400 });
      }
      whereClauses.push(`dr.siswa_id = $${paramIdx++}`);
      params.push(siswaId);
    }
    if (status) {
      whereClauses.push(`dr.status = $${paramIdx++}`);
      params.push(status);
    }
    if (periode) {
      whereClauses.push(`dr.periode = $${paramIdx++}`);
      params.push(periode);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countRes = await query(
      `SELECT COUNT(*)::int as total
       FROM data_raport dr
       JOIN students s ON s.id = dr.siswa_id
       JOIN classes c ON c.id = dr.kelas_id
       JOIN template_raport tr ON tr.id = dr.template_raport_id
       ${whereSQL}`,
      params
    );
    const total = countRes.rows[0].total;

    const res = await query(
      `SELECT dr.id, dr.siswa_id, dr.nisn, dr.nis_lokal, dr.kelas_id, dr.periode,
              dr.jenis_laporan, dr.status, dr.sikap_id, dr.catatan_wali_kelas,
              dr.presensi_snapshot, dr.created_at, dr.updated_at,
              s.nama_siswa, c.nama_kelas,
              tr.nama_template, tr.mode_nilai_akademik
       FROM data_raport dr
       JOIN students s ON s.id = dr.siswa_id
       JOIN classes c ON c.id = dr.kelas_id
       JOIN template_raport tr ON tr.id = dr.template_raport_id
       ${whereSQL}
       ORDER BY c.nama_kelas, s.nama_siswa ASC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, pag.limit, offset(pag)]
    );

    let results = res.rows;

    if (includeHistory && results.length > 0) {
      const raportIds = results.map(r => r.id);

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

    return NextResponse.json(wrapResponse(results, total, pag));
  } catch (error: any) {
    console.error('GET raport status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const userId = session.id;

    const body = await req.json();
    const { data_raport_id, new_status } = body;

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

    // RBAC: status raport HANYA boleh diubah oleh wali kelas kelas tsb.
    // Otoritas diturunkan dari SESSION (server) — bukan dari role yang diklaim
    // client di body — sehingga role lain ('guru_mapel', 'admin', dst.) tidak
    // bisa melewati cek kepemilikan dengan mengubah payload.
    const kelasRes = await query(
      'SELECT kelas_id FROM data_raport WHERE id = $1',
      [data_raport_id]
    );
    if (!kelasRes.rows.length) {
      return NextResponse.json({ error: 'Data raport tidak ditemukan' }, { status: 404 });
    }
    const ownedClassIds = await getOwnedWaliKelasClassIds(userId);
    if (!ownedClassIds.includes(kelasRes.rows[0].kelas_id)) {
      return NextResponse.json(
        { error: 'Forbidden: Anda bukan wali kelas untuk kelas ini' },
        { status: 403 }
      );
    }

    // Use the repository function for status transition (single source of truth).
    // Karena hanya wali kelas yang boleh bertindak, role dicatat sebagai 'wali_kelas'.
    const result = await ubahStatus(
      data_raport_id,
      new_status as StatusRaport,
      userId,
      'wali_kelas' as RoleChangedBy
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
