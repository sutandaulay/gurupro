import { NextResponse } from 'next/server';
import { query, logAudit } from '@/lib/db';
import { cookies } from 'next/headers';
import { hitungNilaiAkhirMapel } from '@/lib/raport/agregatorNilai';

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

    const results: any[] = [];
    let updatedCount = 0;
    let errorCount = 0;

    for (const row of nilaiMapelRes.rows) {
      const hasil = await hitungNilaiAkhirMapel(
        raport.kelas_id,
        row.mapel_id,
        raport.siswa_id,
        raport.periode
      );

      if (hasil.status === 'lengkap' && hasil.nilaiAkhir !== null) {
        await query(
          `UPDATE data_raport_nilai_mapel
           SET nilai_akhir = $1, kkm = $2, updated_at = now()
           WHERE id = $3`,
          [hasil.nilaiAkhir, hasil.kkm, row.nilai_mapel_id]
        );
        updatedCount++;
        results.push({
          mapel_id: row.mapel_id,
          nama_mapel: row.nama_mapel,
          nilai_akhir: hasil.nilaiAkhir,
          kkm: hasil.kkm,
          status: 'updated',
        });
      } else {
        errorCount++;
        results.push({
          mapel_id: row.mapel_id,
          nama_mapel: row.nama_mapel,
          status: 'belum_lengkap',
          detail: hasil.detail,
        });
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
