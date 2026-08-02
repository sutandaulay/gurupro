import { NextResponse } from 'next/server';
import { query, logAudit } from '@/lib/db';
import { cookies } from 'next/headers';


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
    const { data_raport_id, mapel_id } = body;

    if (!data_raport_id) {
      return NextResponse.json({ error: 'data_raport_id wajib diisi' }, { status: 400 });
    }

    const raportRes = await query(
      `SELECT dr.id, dr.kelas_id, dr.siswa_id, dr.periode, dr.status
       FROM data_raport dr
       WHERE dr.id = $1`,
      [data_raport_id]
    );

    if (raportRes.rows.length === 0) {
      return NextResponse.json({ error: 'Raport tidak ditemukan' }, { status: 404 });
    }

    const raport = raportRes.rows[0];

    if (raport.status !== 'draft' && raport.status !== 'dikirim_ke_wali_kelas') {
      return NextResponse.json({
        error: `Tidak bisa refresh nilai saat status '${raport.status}'. Status harus 'draft' atau 'dikirim_ke_wali_kelas'`
      }, { status: 400 });
    }

    const whereClause = mapel_id ? 'AND dnrm.mapel_id = $2' : '';
    const params = mapel_id ? [data_raport_id, mapel_id] : [data_raport_id];

    const nilaiMapelRes = await query(
      `SELECT dnrm.id as nilai_mapel_id, dnrm.mapel_id, sb.nama_mapel
       FROM data_raport_nilai_mapel dnrm
       LEFT JOIN subjects sb ON sb.id = dnrm.mapel_id
       WHERE dnrm.data_raport_id = $1 ${whereClause}`,
      params
    );

    if (nilaiMapelRes.rows.length === 0 && mapel_id) {
      return NextResponse.json({ error: 'Nilai mapel tidak ditemukan' }, { status: 404 });
    }

    // Batch #1: ambil semua assessments + student_grades untuk SEMUA mapel
    const allMapelIds = nilaiMapelRes.rows.map(r => r.mapel_id);
    const wherePeriode = raport.periode ? `AND a.periode = $4` : '';
    const paramsPeriode = raport.periode
      ? [raport.siswa_id, raport.kelas_id, allMapelIds, raport.periode]
      : [raport.siswa_id, raport.kelas_id, allMapelIds];

    const assessmentsRes = allMapelIds.length > 0 ? await query(
      `SELECT a.id, a.subject_id, a.nama_asesmen,
              COALESCE(a.is_akhir_semester, false) as is_akhir_semester,
              a.kkm,
              sg.nilai_akhir as nilai
       FROM assessments a
       LEFT JOIN student_grades sg ON sg.assessment_id = a.id AND sg.student_id = $1
       WHERE a.class_id = $2
         AND a.subject_id = ANY($3::uuid[])
         AND a.tipe_asesmen IN ('sumatif', 'Sumatif')
       ${wherePeriode}
       ORDER BY a.subject_id, a.created_at ASC`,
      paramsPeriode
    ) : { rows: [] };

    const asesmenByMapel = new Map();
    for (const row of assessmentsRes.rows) {
      const list = asesmenByMapel.get(row.subject_id);
      if (list) { list.push(row); } else { asesmenByMapel.set(row.subject_id, [row]); }
    }

    const results: any[] = [];
    let updatedCount = 0;
    let errorCount = 0;

    for (const row of nilaiMapelRes.rows) {
      const rowsAsesmen = asesmenByMapel.get(row.mapel_id) || [];

      if (rowsAsesmen.length === 0) {
        errorCount++;
        results.push({ mapel_id: row.mapel_id, nama_mapel: row.nama_mapel, status: 'belum_lengkap' });
        continue;
      }

      const materiRows = rowsAsesmen.filter(r => !r.is_akhir_semester);
      const asRow = rowsAsesmen.find(r => r.is_akhir_semester);
      const kkm = asRow?.kkm ?? rowsAsesmen[0]?.kkm ?? null;

      if (!asRow || asRow.nilai === null) {
        const rataMateri = materiRows.length > 0 && materiRows.every((r: any) => r.nilai !== null)
          ? Math.round(materiRows.reduce((sum: number, r: any) => sum + Number(r.nilai), 0) / materiRows.length * 10) / 10
          : null;
        errorCount++;
        results.push({ mapel_id: row.mapel_id, nama_mapel: row.nama_mapel, status: 'belum_lengkap', detail: { rataRataSumatifMateri: rataMateri, nilaiAkhirSemester: null, countMateri: materiRows.length } });
        continue;
      }

      const validMateri = materiRows.filter(r => r.nilai !== null);

      if (validMateri.length !== materiRows.length && validMateri.length === 0) {
        errorCount++;
        results.push({ mapel_id: row.mapel_id, nama_mapel: row.nama_mapel, status: 'belum_lengkap', detail: { rataRataSumatifMateri: null, nilaiAkhirSemester: Number(asRow.nilai), countMateri: materiRows.length } });
        continue;
      }

      let nilaiAkhir: number | null = null;

      if (validMateri.length > 0) {
        const rataS = validMateri.reduce((sum: number, r: any) => sum + Number(r.nilai), 0) / validMateri.length;
        nilaiAkhir = Math.round(((rataS + Number(asRow.nilai)) / 2) * 10) / 10;
      } else {
        nilaiAkhir = Math.round(Number(asRow.nilai) * 10) / 10;
      }

      if (nilaiAkhir !== null) {
        await query(
          `UPDATE data_raport_nilai_mapel
           SET nilai_akhir = $1, kkm = $2, updated_at = now()
           WHERE id = $3`,
          [nilaiAkhir, kkm, row.nilai_mapel_id]
        );
        updatedCount++;
        results.push({ mapel_id: row.mapel_id, nama_mapel: row.nama_mapel, nilai_akhir: nilaiAkhir, kkm, status: 'updated' });
      } else {
        errorCount++;
        results.push({ mapel_id: row.mapel_id, nama_mapel: row.nama_mapel, status: 'belum_lengkap', detail: 'Gagal hitung nilai akhir' });
      }
    }

    await logAudit(
      userId,
      'REFRESH_NILAI_RAPORT',
      `Refresh nilai raport ${data_raport_id}: ${updatedCount} diupdate, ${errorCount} belum lengkap`
    );

    return NextResponse.json({
      success: errorCount === 0,
      updated_count: updatedCount,
      error_count: errorCount,
      details: results,
    });
  } catch (error: any) {
    console.error('POST refresh_nilai error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
