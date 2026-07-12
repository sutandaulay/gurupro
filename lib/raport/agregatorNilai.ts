import { query } from '@/lib/db';

export interface AsesmenSumatif {
  id: string;
  nama_asesmen: string;
  is_akhir_semester: boolean;
  kkm: number;
  nilai: number;
}

export interface HasilHitungNilaiAkhir {
  nilaiAkhir: number | null;
  kkm: number | null;
  status: 'lengkap' | 'belum_lengkap';
  detail?: {
    rataRataSumatifMateri: number | null;
    nilaiAkhirSemester: number | null;
    countMateri: number;
  };
}

export interface StudentAssessment {
  siswaId: string;
  nisn: string;
  nisLokal: string;
  namaSiswa: string;
  kelasId: string;
  subjectId: string;
  namaMapel: string;
  assessments: AsesmenSumatif[];
}

export async function hitungNilaiAkhirMapel(
  kelasId: string,
  mapelId: string,
  siswaId: string,
  periode?: string
): Promise<HasilHitungNilaiAkhir> {
  const whereClause = periode
    ? `AND a.periode = $4`
    : '';

  const params = periode
    ? [kelasId, mapelId, siswaId, periode]
    : [kelasId, mapelId, siswaId];

  const res = await query(
    `SELECT
       a.id,
       a.nama_asesmen,
       COALESCE(a.is_akhir_semester, false) as is_akhir_semester,
       a.kkm,
       sg.nilai_akhir as nilai
     FROM assessments a
     LEFT JOIN student_grades sg ON sg.assessment_id = a.id AND sg.student_id = $3
     WHERE a.class_id = $1
       AND a.subject_id = $2
       AND a.tipe_asesmen IN ('sumatif', 'Sumatif')
     ${whereClause}
     ORDER BY a.created_at ASC`,
    params
  );

  const rows: AsesmenSumatif[] = res.rows;

  if (rows.length === 0) {
    return {
      nilaiAkhir: null,
      kkm: null,
      status: 'belum_lengkap',
    };
  }

  const materiRows = rows.filter(r => !r.is_akhir_semester);
  const asRow = rows.find(r => r.is_akhir_semester);

  if (!asRow || asRow.nilai === null) {
    return {
      nilaiAkhir: null,
      kkm: asRow?.kkm ?? rows[0]?.kkm ?? null,
      status: 'belum_lengkap',
      detail: {
        rataRataSumatifMateri: materiRows.length > 0 && materiRows.every(r => r.nilai !== null)
          ? Math.round(
              materiRows.reduce((sum, r) => sum + Number(r.nilai), 0) / materiRows.length * 10
            ) / 10
          : null,
        nilaiAkhirSemester: null,
        countMateri: materiRows.length,
      },
    };
  }

  const validMateri = materiRows.filter(r => r.nilai !== null);

  if (validMateri.length !== materiRows.length && validMateri.length === 0) {
    return {
      nilaiAkhir: null,
      kkm: asRow.kkm,
      status: 'belum_lengkap',
      detail: {
        rataRataSumatifMateri: null,
        nilaiAkhirSemester: Number(asRow.nilai),
        countMateri: materiRows.length,
      },
    };
  }

  const nilaiS = validMateri.length > 0
    ? validMateri.reduce((sum, r) => sum + Number(r.nilai), 0) / validMateri.length
    : null;

  let nilaiAkhir: number | null = null;

  if (nilaiS !== null) {
    nilaiAkhir = Math.round(((nilaiS + Number(asRow.nilai)) / 2) * 10) / 10;
  } else {
    nilaiAkhir = Math.round(Number(asRow.nilai) * 10) / 10;
  }

  return {
    nilaiAkhir,
    kkm: asRow.kkm,
    status: 'lengkap',
    detail: {
      rataRataSumatifMateri: nilaiS !== null
        ? Math.round(nilaiS * 10) / 10
        : null,
      nilaiAkhirSemester: Number(asRow.nilai),
      countMateri: validMateri.length,
    },
  };
}

export async function getNilaiMapelSiswa(
  kelasId: string,
  siswaId: string,
  periode?: string
): Promise<Map<string, { subjectId: string; namaMapel: string; hasil: HasilHitungNilaiAkhir }>> {
  const whereClause = periode ? `AND a.periode = $3` : '';
  const params = periode ? [kelasId, siswaId, periode] : [kelasId, siswaId];

  const res = await query(
    `SELECT DISTINCT
       a.subject_id,
       sb.nama_mapel
     FROM assessments a
     JOIN subjects sb ON sb.id = a.subject_id
     WHERE a.class_id = $1
       AND a.tipe_asesmen IN ('sumatif', 'Sumatif')
     ${whereClause}`,
    params
  );

  const result = new Map<string, { subjectId: string; namaMapel: string; hasil: HasilHitungNilaiAkhir }>();

  for (const row of res.rows) {
    const subjectId: string = row.subject_id;
    const namaMapel: string = row.nama_mapel;

    const hasil = await hitungNilaiAkhirMapel(kelasId, subjectId, siswaId, periode);

    result.set(subjectId, { subjectId, namaMapel, hasil });
  }

  return result;
}

export async function refreshDataRaportFromBukuNilai(
  dataRaportId: string
): Promise<{
  success: boolean;
  updatedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updatedCount = 0;

  const raportRes = await query(
    `SELECT dr.id, dr.kelas_id, dr.siswa_id, dr.periode,
            dnrm.id as nilai_mapel_id, dnrm.mapel_id, dnrm.guru_mapel_member_id
     FROM data_raport dr
     JOIN data_raport_nilai_mapel dnrm ON dnrm.data_raport_id = dr.id
     WHERE dr.id = $1`,
    [dataRaportId]
  );

  if (raportRes.rows.length === 0) {
    return { success: false, updatedCount: 0, errors: ['Raport tidak ditemukan'] };
  }

  const raport = raportRes.rows[0];

  for (const nilaiMapel of raportRes.rows) {
    const hasil = await hitungNilaiAkhirMapel(
      raport.kelas_id,
      nilaiMapel.mapel_id,
      raport.siswa_id,
      raport.periode
    );

    if (hasil.status === 'lengkap' && hasil.nilaiAkhir !== null) {
      await query(
        `UPDATE data_raport_nilai_mapel
         SET nilai_akhir = $1, kkm = $2, updated_at = now()
         WHERE id = $3`,
        [hasil.nilaiAkhir, hasil.kkm, nilaiMapel.nilai_mapel_id]
      );
      updatedCount++;
    } else {
      errors.push(
        `Mapel ${nilaiMapel.mapel_id}: belum lengkap (${hasil.status})`
      );
    }
  }

  return {
    success: errors.length === 0,
    updatedCount,
    errors,
  };
}

export async function validateAllNilaiMapelConfirmed(
  dataRaportId: string
): Promise<{
  valid: boolean;
  unconfirmedMapels: string[];
}> {
  const res = await query(
    `SELECT dnrm.id, dnrm.mapel_id, dnrm.dikonfirmasi_guru, sb.nama_mapel
     FROM data_raport_nilai_mapel dnrm
     JOIN data_raport dr ON dr.id = dnrm.data_raport_id
     LEFT JOIN subjects sb ON sb.id = dnrm.mapel_id
     WHERE dr.id = $1`,
    [dataRaportId]
  );

  const unconfirmedMapels = res.rows
    .filter(row => !row.dikonfirmasi_guru)
    .map(row => row.nama_mapel || row.mapel_id);

  return {
    valid: unconfirmedMapels.length === 0,
    unconfirmedMapels,
  };
}

export async function canChangeStatusToDifinalisasi(
  dataRaportId: string
): Promise<{
  canChange: boolean;
  reason?: string;
  unconfirmedMapels?: string[];
}> {
  const raportRes = await query(
    `SELECT status FROM data_raport WHERE id = $1`,
    [dataRaportId]
  );

  if (raportRes.rows.length === 0) {
    return { canChange: false, reason: 'Raport tidak ditemukan' };
  }

  const currentStatus = raportRes.rows[0].status;

  if (currentStatus !== 'dikonfirmasi') {
    return { canChange: false, reason: `Status harus 'dikonfirmasi' dulu, status saat ini: '${currentStatus}'` };
  }

  const validation = await validateAllNilaiMapelConfirmed(dataRaportId);

  if (!validation.valid) {
    return {
      canChange: false,
      reason: 'Semua mapel harus dikonfirmasi guru sebelum difinalisasi',
      unconfirmedMapels: validation.unconfirmedMapels,
    };
  }

  return { canChange: true };
}
