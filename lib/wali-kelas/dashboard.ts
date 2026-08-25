/**
 * Wali Kelas Dashboard aggregation (Tab Dashboard + Tab Laporan).
 *
 * Reuses existing app-side functions (getPresensiSnapshot, getPenilaianSikap,
 * getCatatanWaliKelas) — no parallel/duplicate functions. All per-student data
 * is fetched in BATCH (one query per dataset) to avoid N+1 when rendering a
 * whole class.
 */

import { query } from '@/lib/db';
import {
  getPresensiSnapshot,
  getPenilaianSikap,
  getCatatanWaliKelas,
} from '@/lib/sikap-ekskul';
import type { PenilaianSikapResponse, CatatanWaliKelasResponse } from '@/lib/schemas/sikap-ekskul';

export interface PresensiRingkas {
  sakit: number;
  izin: number;
  alpa: number;
}

export interface SiswaStatusRow {
  id: string;
  nama_siswa: string;
  nisn: string | null;
  nis_lokal: string | null;
  nomor_absen: number | null;
  status: {
    sikapTerisi: boolean;
    catatanTerisi: boolean;
    presensi: PresensiRingkas;
  };
}

/**
 * Nilai per mapel dalam satu raport (dari data_raport_nilai_mapel).
 * guruNama di-resolve dari users (guru_mapel_member_id menyimpan users.id /
 * institution_members.app_user_id), bukan institution_members.id (integer PK).
 */
export interface RaportNilaiMapel {
  mapelId: string;
  namaMapel: string;
  guruNama: string | null;
  nilaiAkhir: number | null;
  kkm: number | null;
  deskripsiCapaian: string;
  dikonfirmasiGuru: boolean;
  deskripsiDibukaUntukReview: boolean;
}

export interface WaliKelasDashboardData {
  kelas: {
    id: string;
    nama_kelas: string;
    school_id: string;
    wali_kelas: string | null;
  };
  periode: string;
  siswa: SiswaStatusRow[];
  sikap: Array<{
    siswaId: string;
    varian: string;
    penilaianPerDimensi: PenilaianSikapResponse['penilaianPerDimensi'];
    deskripsiUmum: string;
    dinilaiOleh: string;
    createdAt: string;
  }>;
  catatan: Array<{
    siswaId: string;
    catatan: string;
    ditulisOleh: string;
    updatedAt: string;
  }>;
  raportStatus: Array<{
    siswaId: string;
    raportId: string;
    status: string;
    namaTemplate: string;
    jenisLaporan: string;
    updatedAt: string;
    modeNilaiAkademik: string;
    nilaiMapel: RaportNilaiMapel[];
  }>;
  statistik: {
    totalSiswa: number;
    sikapTerisi: number;
    catatanTerisi: number;
    totalPresensi: PresensiRingkas;
  };
}

/**
 * Classes owned by the user as homeroom teacher.
 * Covers BOTH the Master Data path (classes.wali_kelas_user_id = users.id)
 * AND the assignment path (wali_kelas_assignments.wali_kelas_member_id =
 * institution_members.id Payload UUID, resolved via Payload lookup using
 * appUserId = userId).
 *
 * Previously this compared session userId directly against
 * wali_kelas_member_id which stores institution_members.id (Payload UUID) —
 * two different UUID spaces, so the assignment path never matched.
 */
export async function getOwnedWaliKelasClassIds(userId: string): Promise<string[]> {
  // Path A — Always: classes.wali_kelas_user_id = users.id (direct FK).
  const classesRes = await query(
    'SELECT id FROM classes WHERE wali_kelas_user_id = $1',
    [userId]
  );

  // Path B — Institution mode: resolve institution_members.id (Payload UUID)
  // via Payload lookup, then filter by wali_kelas_assignments.
  let assignRes = { rows: [] as any[] };
  try {
    const { getPayload } = await import('@/lib/payload');
    const payload = await getPayload();
    const memberResult = await payload.find({
      collection: 'institution-members',
      where: {
        appUserId: { equals: userId },
        status: { equals: 'active' },
      },
      limit: 1,
    });

    if (memberResult.docs.length > 0) {
      const memberId = String(memberResult.docs[0].id);
      assignRes = await query(
        `SELECT DISTINCT kelas_id
         FROM wali_kelas_assignments
         WHERE wali_kelas_member_id = $1 AND status = 'aktif'`,
        [memberId]
      );
    }
  } catch {
    // No institution membership or Payload lookup failed — skip assignment path.
  }

  const ids = new Set<string>();
  for (const row of classesRes.rows) if (row.id) ids.add(String(row.id));
  for (const row of assignRes.rows) if (row.kelas_id) ids.add(String(row.kelas_id));
  return [...ids];
}

/**
 * Normalize periode dashboard ("2025/2026-ganjil") ke bentuk dasar yang bisa
 * dicocokkan dengan data_raport.periode yang berformat "TS-2025/2026-Ganjil" /
 * "AS-2025/2026-Ganjil". Kedua format dipetakan ke "2025/2026-ganjil" sehingga
 * pencocokan raport tidak kehilangan data karena beda casing/prefix.
 */
function normalizeRaportPeriode(periode: string): string {
  const m = periode.match(/(\d{4}\/\d{4})-(\w+)/i);
  if (m) return `${m[1]}-${m[2].toLowerCase()}`;
  return periode.toLowerCase();
}

/**
 * Fetch the whole dashboard payload for one owned class + periode.
 * All datasets are fetched in batch (constant number of queries, no per-student loop).
 */
export async function getWaliKelasDashboardData(
  kelasId: string,
  periode: string
): Promise<WaliKelasDashboardData> {
  const [kelasRes, siswaRes, sikapRes, catatanRes] = await Promise.all([
    query(
      `SELECT c.id, c.nama_kelas, c.school_id, COALESCE(u.nama_lengkap, c.wali_kelas) as wali_kelas
       FROM classes c
       LEFT JOIN users u ON u.id = c.wali_kelas_user_id
       WHERE c.id = $1`,
      [kelasId]
    ),
    query(
      `SELECT id, nama_siswa, nisn, nis_lokal, nomor_absen
       FROM students
       WHERE class_id = $1
       ORDER BY nomor_absen ASC, nama_siswa ASC`,
      [kelasId]
    ),
    getPenilaianSikap({ kelasId, periode }),
    getCatatanWaliKelas({ kelasId, periode }),
  ]);

  const siswaIds: string[] = siswaRes.rows.map((r: any) => r.id);

  // Batch presence snapshot: ONE query for the whole class (avoids N+1).
  const presensiMap =
    siswaIds.length > 0
      ? ((await getPresensiSnapshot(siswaIds, kelasId, periode)) as Record<string, PresensiRingkas>)
      : {};

  // Raport status per siswa (batch, scoped to kelas + periode).
  // data_raport.periode berformat "TS-2025/2026-Ganjil"/"AS-2025/2026-Ganjil",
  // dashboard periode berformat "2025/2026-ganjil" -> cocokkan lewat normalizeRaportPeriode.
  const raportRes = await query(
    `SELECT dr.siswa_id, dr.id as raport_id, dr.status, dr.jenis_laporan, dr.updated_at,
            tr.nama_template, tr.mode_nilai_akademik
     FROM data_raport dr
     LEFT JOIN template_raport tr ON tr.id = dr.template_raport_id
     WHERE dr.kelas_id = $1
       AND LOWER(dr.periode) LIKE '%' || $2 || '%'
     ORDER BY dr.updated_at DESC`,
    [kelasId, normalizeRaportPeriode(periode)]
  );

  // Nilai per mapel per raport — SATU query batch untuk semua raport kelas ini
  // (hindari N+1). guru_mapel_member_id menyimpan users.id, jadi join langsung
  // ke users untuk nama guru (bukan via institution_members.id yang integer PK).
  const raportIds: string[] = raportRes.rows.map((r: any) => r.raport_id);
  const nilaiRes =
    raportIds.length > 0
      ? await query(
          `SELECT dnrm.data_raport_id, dnrm.mapel_id, dnrm.guru_mapel_member_id,
                  dnrm.nilai_akhir, dnrm.kkm, dnrm.deskripsi_capaian,
                  dnrm.dikonfirmasi_guru, dnrm.deskripsi_dibuka_untuk_review,
                  sb.nama_mapel,
                  u.nama_lengkap as guru_nama
           FROM data_raport_nilai_mapel dnrm
           LEFT JOIN subjects sb ON sb.id = dnrm.mapel_id
           LEFT JOIN users u ON u.id = dnrm.guru_mapel_member_id
           WHERE dnrm.data_raport_id = ANY($1::uuid[])
           ORDER BY dnrm.data_raport_id, sb.nama_mapel ASC`,
          [raportIds]
        )
      : { rows: [] };

  const nilaiByRaport = new Map<string, any[]>();
  for (const row of nilaiRes.rows) {
    const list = nilaiByRaport.get(row.data_raport_id);
    if (list) list.push(row);
    else nilaiByRaport.set(row.data_raport_id, [row]);
  }

  const sikapBySiswa = new Map<string, PenilaianSikapResponse>();
  for (const s of sikapRes.data) sikapBySiswa.set(s.siswaId, s);
  const catatanBySiswa = new Map<string, CatatanWaliKelasResponse>();
  for (const c of catatanRes.data) catatanBySiswa.set(c.siswaId, c);

  const siswa: SiswaStatusRow[] = siswaRes.rows.map((row: any) => {
    const presensi = presensiMap[row.id] || { sakit: 0, izin: 0, alpa: 0 };
    return {
      id: row.id,
      nama_siswa: row.nama_siswa,
      nisn: row.nisn ?? null,
      nis_lokal: row.nis_lokal ?? null,
      nomor_absen: row.nomor_absen ?? null,
      status: {
        sikapTerisi: sikapBySiswa.has(row.id),
        catatanTerisi: catatanBySiswa.has(row.id),
        presensi,
      },
    };
  });

  // TODO: agregasi nilai lintas mapel di bawah KKM — deferred, lihat prompt v2
  const statistik = {
    totalSiswa: siswa.length,
    sikapTerisi: siswa.filter((s) => s.status.sikapTerisi).length,
    catatanTerisi: siswa.filter((s) => s.status.catatanTerisi).length,
    totalPresensi: siswa.reduce(
      (acc, s) => ({
        sakit: acc.sakit + s.status.presensi.sakit,
        izin: acc.izin + s.status.presensi.izin,
        alpa: acc.alpa + s.status.presensi.alpa,
      }),
      { sakit: 0, izin: 0, alpa: 0 }
    ),
  };

  const kelasRow = kelasRes.rows[0];

  return {
    kelas: kelasRow
      ? {
          id: kelasRow.id,
          nama_kelas: kelasRow.nama_kelas,
          school_id: kelasRow.school_id,
          wali_kelas: kelasRow.wali_kelas ?? null,
        }
      : { id: kelasId, nama_kelas: '(kelas tidak ditemukan)', school_id: '', wali_kelas: null },
    periode,
    siswa,
    sikap: sikapRes.data.map((s) => ({
      siswaId: s.siswaId,
      varian: s.varian,
      penilaianPerDimensi: s.penilaianPerDimensi,
      deskripsiUmum: s.deskripsiUmum,
      dinilaiOleh: s.dinilaiOleh,
      createdAt: s.createdAt,
    })),
    catatan: catatanRes.data.map((c) => ({
      siswaId: c.siswaId,
      catatan: c.catatan,
      ditulisOleh: c.ditulisOleh,
      updatedAt: c.updatedAt,
    })),
    raportStatus: raportRes.rows.map((r: any) => ({
      siswaId: r.siswa_id,
      raportId: r.raport_id,
      status: r.status,
      namaTemplate: r.nama_template ?? '',
      jenisLaporan: r.jenis_laporan,
      updatedAt: r.updated_at,
      modeNilaiAkademik: r.mode_nilai_akademik ?? '',
      nilaiMapel: (nilaiByRaport.get(r.raport_id) || []).map((nm: any) => ({
        mapelId: nm.mapel_id,
        namaMapel: nm.nama_mapel ?? '',
        guruNama: nm.guru_nama ?? null,
        nilaiAkhir: nm.nilai_akhir == null ? null : Number(nm.nilai_akhir),
        kkm: nm.kkm == null ? null : Number(nm.kkm),
        deskripsiCapaian: nm.deskripsi_capaian ?? '',
        dikonfirmasiGuru: !!nm.dikonfirmasi_guru,
        deskripsiDibukaUntukReview: !!nm.deskripsi_dibuka_untuk_review,
      })),
    })),
    statistik,
  };
}
