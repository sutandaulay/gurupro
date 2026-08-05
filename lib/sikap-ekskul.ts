/**
 * File 03: Sikap, Ekstrakurikuler, Catatan Wali Kelas - Application Layer Functions
 * Purpose: Business logic for penilaian_sikap, ekstrakurikuler, penilaian_ekstrakurikuler, catatan_wali_kelas tables
 *
 * RBAC Validation:
 * - Penilaian Sikap & Catatan Wali Kelas: Must be active homeroom teacher for the class
 * - Ekstrakurikuler & Penilaian Ekskul: Must be the assigned pembina
 */

import { query } from '@/lib/db';
import { getWaliKelasForKelas, getActiveTahunAjaran, getCurrentSemester } from '@/lib/wali-kelas';
import type { PaginationParams } from '@/lib/pagination';
import {
  PenilaianSikapCreate,
  PenilaianSikapUpdate,
  PenilaianSikapRow,
  PenilaianSikapResponse,
  PenilaianSikapQuery,
  EkstrakurikulerCreate,
  EkstrakurikulerUpdate,
  EkstrakurikulerRow,
  EkstrakurikulerResponse,
  EkstrakurikulerQuery,
  PenilaianEkstrakurikulerCreate,
  PenilaianEkstrakurikulerUpdate,
  PenilaianEkstrakurikulerRow,
  PenilaianEkstrakurikulerResponse,
  PenilaianEkstrakurikulerQuery,
  CatatanWaliKelasCreate,
  CatatanWaliKelasUpdate,
  CatatanWaliKelasRow,
  CatatanWaliKelasResponse,
  CatatanWaliKelasQuery,
  DimensiPredikat,
} from '@/lib/schemas/sikap-ekskul';

// =====================================================
// Presensi Snapshot Helper
// =====================================================

export interface PresensiSnapshot {
  sakit: number;
  izin: number;
  alpa: number;
}

export async function getPresensiSnapshot(
  siswaId: string,
  kelasId: string,
  periode: string
): Promise<PresensiSnapshot> {
  // Parse periode: "2025/2026-ganjil" or similar format
  const match = periode.match(/(\d{4})\/(\d{4})-(\w+)/);
  if (!match) {
    return { sakit: 0, izin: 0, alpa: 0 };
  }
  const [, tahunAjar, , semester] = match;

  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE sa.status = 'sakit') as sakit,
       COUNT(*) FILTER (WHERE sa.status = 'izin') as izin,
       COUNT(*) FILTER (WHERE sa.status = 'alpa') as alpa
     FROM student_attendance sa
     JOIN schedules sch ON sch.id = sa.schedule_id
     JOIN tahun_ajaran ta ON ta.nama LIKE $1
     WHERE sa.student_id = $2
       AND sch.class_id = $3
       AND ta.semester = $4`,
    [`%${tahunAjar}%`, siswaId, kelasId, semester]
  );

  return {
    sakit: parseInt(result.rows[0]?.sakit || '0', 10),
    izin: parseInt(result.rows[0]?.izin || '0', 10),
    alpa: parseInt(result.rows[0]?.alpa || '0', 10),
  };
}

// =====================================================
// Penilaian Sikap Functions
// =====================================================

/**
 * Insert penilaian sikap with RBAC validation
 * Only active homeroom teacher for this class can insert
 */
export async function insertPenilaianSikap(
  input: PenilaianSikapCreate,
  actorMemberId: string
): Promise<PenilaianSikapResponse> {
  // Get active tahun ajaran and semester from periode
  const tahunAjaranMatch = input.periode.match(/(\d{4})\/(\d{4})-(\w+)/);
  if (!tahunAjaranMatch) {
    throw new Error('Format periode tidak valid. Gunakan format: YYYY/YYYY-smt');
  }
  const [, tahunAjar, , semester] = tahunAjaranMatch;
  const semesterEnum = semester as 'ganjil' | 'genap';

  // RBAC: Validate actor is active homeroom teacher for this class
  const waliKelas = await getWaliKelasForKelas(input.kelasId, tahunAjar, semesterEnum);
  const isWaliKelasValid = waliKelas && waliKelas.waliKelasMemberId === actorMemberId;
  if (!isWaliKelasValid) {
    // Fallback: check classes.wali_kelas_user_id (legacy system from Master Data checkbox)
    const fallback = await query(
      `SELECT 1 FROM classes c
       WHERE c.id = $1 AND c.wali_kelas_user_id = (
         SELECT im.app_user_id::uuid FROM institution_members im WHERE im.id = $2
       )
       LIMIT 1`,
      [input.kelasId, actorMemberId]
    );
    if (fallback.rows.length === 0) {
      throw new Error('Hanya wali kelas aktif kelas ini yang bisa mengisi sikap siswa');
    }
  }

  // Validate siswa belongs to this kelas
  const siswaCheck = await query(
    'SELECT id FROM students WHERE id = $1 AND class_id = $2',
    [input.siswaId, input.kelasId]
  );
  if (!siswaCheck.rows.length) {
    throw new Error('Siswa tidak ditemukan di kelas ini');
  }

  // Insert
  const result = await query(
    `INSERT INTO penilaian_sikap
     (siswa_id, kelas_id, periode, varian, penilaian_per_dimensi, deskripsi_umum, dinilai_oleh)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.siswaId,
      input.kelasId,
      input.periode,
      input.varian,
      JSON.stringify(input.penilaianPerDimensi),
      input.deskripsiUmum,
      actorMemberId,
    ]
  );

  return mapPenilaianSikapRowToResponse(result.rows[0]);
}

/**
 * Update penilaian sikap
 */
export async function updatePenilaianSikap(
  input: PenilaianSikapUpdate,
  actorMemberId: string
): Promise<PenilaianSikapResponse> {
  const existing = await query(
    'SELECT * FROM penilaian_sikap WHERE id = $1',
    [input.id]
  );
  if (!existing.rows.length) {
    throw new Error('Penilaian sikap tidak ditemukan');
  }

  // RBAC: Only the original assessor can update
  if (existing.rows[0].dinilai_oleh !== actorMemberId) {
    throw new Error('Hanya penilai asli yang bisa mengubah penilaian sikap');
  }

  const updates: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (input.penilaianPerDimensi) {
    updates.push(`penilaian_per_dimensi = $${idx++}`);
    params.push(JSON.stringify(input.penilaianPerDimensi));
  }
  if (input.deskripsiUmum) {
    updates.push(`deskripsi_umum = $${idx++}`);
    params.push(input.deskripsiUmum);
  }

  if (updates.length === 0) {
    return mapPenilaianSikapRowToResponse(existing.rows[0]);
  }

  params.push(input.id);
  const result = await query(
    `UPDATE penilaian_sikap SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  return mapPenilaianSikapRowToResponse(result.rows[0]);
}

/**
 * Get penilaian sikap with filters
 */
export async function getPenilaianSikap(
  filters: PenilaianSikapQuery,
  pagination?: PaginationParams
): Promise<{ data: PenilaianSikapResponse[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.siswaId) {
    conditions.push(`ps.siswa_id = $${idx++}`);
    params.push(filters.siswaId);
  }
  if (filters.kelasId) {
    conditions.push(`ps.kelas_id = $${idx++}`);
    params.push(filters.kelasId);
  }
  if (filters.periode) {
    conditions.push(`ps.periode = $${idx++}`);
    params.push(filters.periode);
  }
  if (filters.varian) {
    conditions.push(`ps.varian = $${idx++}`);
    params.push(filters.varian);
  }
  if (filters.dinilaiOleh) {
    conditions.push(`ps.dinilai_oleh = $${idx++}`);
    params.push(filters.dinilaiOleh);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM penilaian_sikap ps
     LEFT JOIN students s ON s.id = ps.siswa_id
     ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  let limitOffset = '';
  if (pagination) {
    const off = (pagination.page - 1) * pagination.limit;
    limitOffset = ` LIMIT ${pagination.limit} OFFSET ${off}`;
  }

  const result = await query(
    `SELECT ps.*, s.nama_siswa
     FROM penilaian_sikap ps
     LEFT JOIN students s ON s.id = ps.siswa_id
     ${where}
     ORDER BY ps.created_at DESC${limitOffset}`,
    params
  );

  return { data: result.rows.map(mapPenilaianSikapRowToResponse), total };
}

/**
 * Get sikap by siswa and periode (for raport)
 */
export async function getSikapForRaport(
  siswaId: string,
  kelasId: string,
  periode: string
): Promise<PenilaianSikapResponse | null> {
  const result = await query(
    `SELECT * FROM penilaian_sikap
     WHERE siswa_id = $1 AND kelas_id = $2 AND periode = $3
     LIMIT 1`,
    [siswaId, kelasId, periode]
  );

  return result.rows.length ? mapPenilaianSikapRowToResponse(result.rows[0]) : null;
}

function mapPenilaianSikapRowToResponse(row: PenilaianSikapRow): PenilaianSikapResponse {
  return {
    id: row.id,
    siswaId: row.siswa_id,
    kelasId: row.kelas_id,
    periode: row.periode,
    varian: row.varian as 'profil_pelajar_pancasila' | 'dimensi_profil_lulusan_madrasah' | 'profil_rahmatan_lil_alamin',
    penilaianPerDimensi: row.penilaian_per_dimensi as DimensiPredikat[],
    deskripsiUmum: row.deskripsi_umum,
    dinilaiOleh: row.dinilai_oleh,
    createdAt: row.created_at,
  };
}

// =====================================================
// Ekstrakurikuler Functions
// =====================================================

/**
 * Create ekstrakurikuler
 */
export async function createEkstrakurikuler(
  input: EkstrakurikulerCreate
): Promise<EkstrakurikulerResponse> {
  const kelasCheck = await query('SELECT id FROM classes WHERE id = $1', [input.kelasId]);
  if (!kelasCheck.rows.length) {
    throw new Error('Kelas tidak ditemukan');
  }

  const result = await query(
    `INSERT INTO ekstrakurikuler (nama_ekskul, kelas_id, pembina_member_id, pembina_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.namaEkskul, input.kelasId, input.pembinaMemberId || null, input.pembinaUserId || null]
  );

  return mapEkstrakurikulerRowToResponse(result.rows[0]);
}

/**
 * Update ekstrakurikuler
 */
export async function updateEkstrakurikuler(
  input: EkstrakurikulerUpdate
): Promise<EkstrakurikulerResponse> {
  const existing = await query('SELECT * FROM ekstrakurikuler WHERE id = $1', [input.id]);
  if (!existing.rows.length) {
    throw new Error('Ekstrakurikuler tidak ditemukan');
  }

  const updates: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (input.namaEkskul) {
    updates.push(`nama_ekskul = $${idx++}`);
    params.push(input.namaEkskul);
  }
  if (input.pembinaMemberId !== undefined) {
    updates.push(`pembina_member_id = $${idx++}`);
    params.push(input.pembinaMemberId);
  }
  if (input.pembinaUserId !== undefined) {
    updates.push(`pembina_user_id = $${idx++}`);
    params.push(input.pembinaUserId);
  }

  if (updates.length === 0) {
    return mapEkstrakurikulerRowToResponse(existing.rows[0]);
  }

  params.push(input.id);
  const result = await query(
    `UPDATE ekstrakurikuler SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  return mapEkstrakurikulerRowToResponse(result.rows[0]);
}

/**
 * Get ekstrakurikuler with filters
 */
export async function getEkstrakurikuler(
  filters: EkstrakurikulerQuery,
  pagination?: PaginationParams
): Promise<{ data: EkstrakurikulerResponse[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.kelasId) {
    conditions.push(`e.kelas_id = $${idx++}`);
    params.push(filters.kelasId);
  }
  if (filters.pembinaMemberId) {
    conditions.push(`e.pembina_member_id = $${idx++}`);
    params.push(filters.pembinaMemberId);
  }
  if (filters.schoolId) {
    conditions.push(`c.school_id = $${idx++}`);
    params.push(filters.schoolId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM ekstrakurikuler e
     LEFT JOIN classes c ON c.id = e.kelas_id
     ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  let limitOffset = '';
  if (pagination) {
    const off = (pagination.page - 1) * pagination.limit;
    limitOffset = ` LIMIT ${pagination.limit} OFFSET ${off}`;
  }

  const result = await query(
    `SELECT e.*, c.nama_kelas, c.school_id
     FROM ekstrakurikuler e
     LEFT JOIN classes c ON c.id = e.kelas_id
     ${where}
     ORDER BY e.nama_ekskul ASC${limitOffset}`,
    params
  );

  return { data: result.rows.map(mapEkstrakurikulerRowToResponse), total };
}

/**
 * Get ekskul by pembina (for pembina's dashboard)
 */
export async function getEkskulByPembina(pembinaMemberId: string): Promise<EkstrakurikulerResponse[]> {
  const result = await getEkstrakurikuler({ pembinaMemberId });
  return result.data;
}

function mapEkstrakurikulerRowToResponse(row: any): EkstrakurikulerResponse & { namaKelas?: string } {
  return {
    id: row.id,
    namaEkskul: row.nama_ekskul,
    kelasId: row.kelas_id,
    pembinaMemberId: row.pembina_member_id,
    pembinaUserId: row.pembina_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    namaKelas: row.nama_kelas,
  };
}

// =====================================================
// Penilaian Ekstrakurikuler Functions
// =====================================================

/**
 * Insert penilaian ekstrakurikuler with RBAC validation
 * Only the assigned pembina can insert
 */
export async function insertPenilaianEkstrakurikuler(
  input: PenilaianEkstrakurikulerCreate,
  actorMemberId: string
): Promise<PenilaianEkstrakurikulerResponse> {
  // RBAC: Validate actor is the pembina for this ekskul
  const ekskulCheck = await query(
    'SELECT pembina_member_id FROM ekstrakurikuler WHERE id = $1',
    [input.ekstrakurikulerId]
  );
  if (!ekskulCheck.rows.length) {
    throw new Error('Ekstrakurikuler tidak ditemukan');
  }
  if (ekskulCheck.rows[0].pembina_member_id !== actorMemberId) {
    throw new Error('Hanya pembina ekstrakurikuler ini yang bisa mengisi penilaian');
  }

  // Insert
  const result = await query(
    `INSERT INTO penilaian_ekstrakurikuler
     (siswa_id, ekstrakurikuler_id, periode, predikat, deskripsi, dinilai_oleh)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.siswaId,
      input.ekstrakurikulerId,
      input.periode,
      input.predikat,
      input.deskripsi,
      actorMemberId,
    ]
  );

  return mapPenilaianEkstrakurikulerRowToResponse(result.rows[0]);
}

/**
 * Update penilaian ekstrakurikuler
 */
export async function updatePenilaianEkstrakurikuler(
  input: PenilaianEkstrakurikulerUpdate,
  actorMemberId: string
): Promise<PenilaianEkstrakurikulerResponse> {
  const existing = await query(
    'SELECT * FROM penilaian_ekstrakurikuler WHERE id = $1',
    [input.id]
  );
  if (!existing.rows.length) {
    throw new Error('Penilaian ekstrakurikuler tidak ditemukan');
  }

  // RBAC: Only the original assessor can update
  if (existing.rows[0].dinilai_oleh !== actorMemberId) {
    throw new Error('Hanya penilai asli yang bisa mengubah penilaian ekstrakurikuler');
  }

  const updates: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (input.predikat) {
    updates.push(`predikat = $${idx++}`);
    params.push(input.predikat);
  }
  if (input.deskripsi) {
    updates.push(`deskripsi = $${idx++}`);
    params.push(input.deskripsi);
  }

  if (updates.length === 0) {
    return mapPenilaianEkstrakurikulerRowToResponse(existing.rows[0]);
  }

  params.push(input.id);
  const result = await query(
    `UPDATE penilaian_ekstrakurikuler SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  return mapPenilaianEkstrakurikulerRowToResponse(result.rows[0]);
}

/**
 * Get penilaian ekstrakurikuler with filters
 */
export async function getPenilaianEkstrakurikuler(
  filters: PenilaianEkstrakurikulerQuery,
  pagination?: PaginationParams
): Promise<{ data: PenilaianEkstrakurikulerResponse[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.siswaId) {
    conditions.push(`pe.siswa_id = $${idx++}`);
    params.push(filters.siswaId);
  }
  if (filters.ekstrakurikulerId) {
    conditions.push(`pe.ekstrakurikuler_id = $${idx++}`);
    params.push(filters.ekstrakurikulerId);
  }
  if (filters.periode) {
    conditions.push(`pe.periode = $${idx++}`);
    params.push(filters.periode);
  }
  if (filters.dinilaiOleh) {
    conditions.push(`pe.dinilai_oleh = $${idx++}`);
    params.push(filters.dinilaiOleh);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM penilaian_ekstrakurikuler pe
     LEFT JOIN students s ON s.id = pe.siswa_id
     LEFT JOIN ekstrakurikuler e ON e.id = pe.ekstrakurikuler_id
     ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  let limitOffset = '';
  if (pagination) {
    const off = (pagination.page - 1) * pagination.limit;
    limitOffset = ` LIMIT ${pagination.limit} OFFSET ${off}`;
  }

  const result = await query(
    `SELECT pe.*, s.nama_siswa, e.nama_ekskul
     FROM penilaian_ekstrakurikuler pe
     LEFT JOIN students s ON s.id = pe.siswa_id
     LEFT JOIN ekstrakurikuler e ON e.id = pe.ekstrakurikuler_id
     ${where}
     ORDER BY pe.created_at DESC${limitOffset}`,
    params
  );

  return { data: result.rows.map(mapPenilaianEkstrakurikulerRowToResponse), total };
}

/**
 * Get ekskul assessments for a specific siswa and periode (for raport)
 */
export async function getEkskulForRaport(
  siswaId: string,
  periode: string
): Promise<PenilaianEkstrakurikulerResponse[]> {
  const result = await getPenilaianEkstrakurikuler({ siswaId, periode });
  return result.data;
}

function mapPenilaianEkstrakurikulerRowToResponse(
  row: PenilaianEkstrakurikulerRow
): PenilaianEkstrakurikulerResponse {
  return {
    id: row.id,
    siswaId: row.siswa_id,
    ekstrakurikulerId: row.ekstrakurikuler_id,
    periode: row.periode,
    predikat: row.predikat as 'sangat_baik' | 'baik' | 'cukup' | 'perlu_bimbingan',
    deskripsi: row.deskripsi,
    dinilaiOleh: row.dinilai_oleh,
    createdAt: row.created_at,
  };
}

// =====================================================
// Catatan Wali Kelas Functions
// =====================================================

/**
 * Insert/update catatan wali kelas with RBAC validation
 * Only active homeroom teacher for this class can insert
 */
export async function upsertCatatanWaliKelas(
  input: CatatanWaliKelasCreate,
  actorMemberId: string
): Promise<CatatanWaliKelasResponse> {
  // Get active tahun ajaran and semester from periode
  const tahunAjaranMatch = input.periode.match(/(\d{4})\/(\d{4})-(\w+)/);
  if (!tahunAjaranMatch) {
    throw new Error('Format periode tidak valid. Gunakan format: YYYY/YYYY-smt');
  }
  const [, tahunAjar, , semester] = tahunAjaranMatch;
  const semesterEnum = semester as 'ganjil' | 'genap';

  // RBAC: Validate actor is active homeroom teacher for this class
  const waliKelas = await getWaliKelasForKelas(input.kelasId, tahunAjar, semesterEnum);
  const isWaliKelasValid = waliKelas && waliKelas.waliKelasMemberId === actorMemberId;
  if (!isWaliKelasValid) {
    // Fallback: check classes.wali_kelas_user_id (legacy system from Master Data checkbox)
    const fallback = await query(
      `SELECT 1 FROM classes c
       WHERE c.id = $1 AND c.wali_kelas_user_id = (
         SELECT im.app_user_id::uuid FROM institution_members im WHERE im.id = $2
       )
       LIMIT 1`,
      [input.kelasId, actorMemberId]
    );
    if (fallback.rows.length === 0) {
      throw new Error('Hanya wali kelas aktif kelas ini yang bisa menulis catatan');
    }
  }

  // Validate siswa belongs to this kelas
  const siswaCheck = await query(
    'SELECT id FROM students WHERE id = $1 AND class_id = $2',
    [input.siswaId, input.kelasId]
  );
  if (!siswaCheck.rows.length) {
    throw new Error('Siswa tidak ditemukan di kelas ini');
  }

  // Upsert (insert or update on conflict)
  const result = await query(
    `INSERT INTO catatan_wali_kelas
     (siswa_id, kelas_id, periode, catatan, ditulis_oleh)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (siswa_id, kelas_id, periode)
     DO UPDATE SET catatan = EXCLUDED.catatan, ditulis_oleh = EXCLUDED.ditulis_oleh, updated_at = now()
     RETURNING *`,
    [input.siswaId, input.kelasId, input.periode, input.catatan, actorMemberId]
  );

  return mapCatatanWaliKelasRowToResponse(result.rows[0]);
}

/**
 * Get catatan wali kelas with filters
 */
export async function getCatatanWaliKelas(
  filters: CatatanWaliKelasQuery,
  pagination?: PaginationParams
): Promise<{ data: CatatanWaliKelasResponse[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.siswaId) {
    conditions.push(`cwk.siswa_id = $${idx++}`);
    params.push(filters.siswaId);
  }
  if (filters.kelasId) {
    conditions.push(`cwk.kelas_id = $${idx++}`);
    params.push(filters.kelasId);
  }
  if (filters.periode) {
    conditions.push(`cwk.periode = $${idx++}`);
    params.push(filters.periode);
  }
  if (filters.ditulisOleh) {
    conditions.push(`cwk.ditulis_oleh = $${idx++}`);
    params.push(filters.ditulisOleh);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM catatan_wali_kelas cwk
     LEFT JOIN students s ON s.id = cwk.siswa_id
     ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  let limitOffset = '';
  if (pagination) {
    const off = (pagination.page - 1) * pagination.limit;
    limitOffset = ` LIMIT ${pagination.limit} OFFSET ${off}`;
  }

  const result = await query(
    `SELECT cwk.*, s.nama_siswa
     FROM catatan_wali_kelas cwk
     LEFT JOIN students s ON s.id = cwk.siswa_id
     ${where}
     ORDER BY cwk.updated_at DESC${limitOffset}`,
    params
  );

  return { data: result.rows.map(mapCatatanWaliKelasRowToResponse), total };
}

/**
 * Get catatan for raport
 */
export async function getCatatanForRaport(
  siswaId: string,
  kelasId: string,
  periode: string
): Promise<CatatanWaliKelasResponse | null> {
  const result = await query(
    `SELECT * FROM catatan_wali_kelas
     WHERE siswa_id = $1 AND kelas_id = $2 AND periode = $3
     LIMIT 1`,
    [siswaId, kelasId, periode]
  );

  return result.rows.length ? mapCatatanWaliKelasRowToResponse(result.rows[0]) : null;
}

function mapCatatanWaliKelasRowToResponse(row: CatatanWaliKelasRow): CatatanWaliKelasResponse {
  return {
    id: row.id,
    siswaId: row.siswa_id,
    kelasId: row.kelas_id,
    periode: row.periode,
    catatan: row.catatan,
    ditulisOleh: row.ditulis_oleh,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =====================================================
// Bulk Operations for Raport Generation
// =====================================================

export interface RaportSikapEkskulData {
  sikap: PenilaianSikapResponse | null;
  ekskul: PenilaianEkstrakurikulerResponse[];
  catatan: CatatanWaliKelasResponse | null;
}

/**
 * Get all sikap, ekskul, catatan data for a siswa in a periode
 */
export async function getRaportSikapEkskulData(
  siswaId: string,
  kelasId: string,
  periode: string
): Promise<RaportSikapEkskulData> {
  const [sikap, ekskul, catatan] = await Promise.all([
    getSikapForRaport(siswaId, kelasId, periode),
    getEkskulForRaport(siswaId, periode),
    getCatatanForRaport(siswaId, kelasId, periode),
  ]);

  return { sikap, ekskul, catatan };
}
