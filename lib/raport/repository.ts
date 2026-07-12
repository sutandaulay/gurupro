import { query } from '@/lib/db';
import {
  CreateDataRaportInputSchema,
  CreateDataRaportInput,
  UpdateNilaiMapelInputSchema,
  UpdateNilaiMapelInput,
  ChangeStatusInputSchema,
  ChangeStatusInput,
  StatusHistoryEntry,
} from './schemas';
import {
  refreshDataRaportFromBukuNilai,
  canChangeStatusToDifinalisasi,
} from './agregatorNilai';
import { getWaliKelasForKelas, getActiveTahunAjaran, getCurrentSemester } from '@/lib/wali-kelas';
import { sendRaportNotification, RaportStatusEvent } from './notifications';

// =====================================================
// Status Transition Types
// =====================================================

export const STATUS_ORDER: Record<string, number> = {
  draft: 0,
  dikirim_ke_wali_kelas: 1,
  dikonfirmasi: 2,
  difinalisasi: 3,
  siap_print: 4,
};

export const TRANSISI_VALID: Record<string, string[]> = {
  draft: ['dikirim_ke_wali_kelas'],
  dikirim_ke_wali_kelas: ['dikonfirmasi', 'draft'],
  dikonfirmasi: ['difinalisasi', 'dikirim_ke_wali_kelas'],
  difinalisasi: ['siap_print'],
  siap_print: [],
};

export type StatusRaport = keyof typeof STATUS_ORDER;
export type RoleChangedBy = 'guru_mapel' | 'wali_kelas' | 'kepala_sekolah' | 'admin';

export interface TransisiResult {
  boleh: boolean;
  alasan?: string;
}

/**
 * Validates whether a status transition is allowed based on the state machine rules.
 * This is the single source of truth for determining if a transition is valid.
 */
export async function bisaTransisi(
  dataRaportId: string,
  keStatus: StatusRaport
): Promise<TransisiResult> {
  const raportRes = await query(
    `SELECT dr.*, c.id as class_id
     FROM data_raport dr
     JOIN classes c ON c.id = dr.kelas_id
     WHERE dr.id = $1`,
    [dataRaportId]
  );

  if (!raportRes.rows.length) {
    return { boleh: false, alasan: 'Data raport tidak ditemukan' };
  }

  const raport = raportRes.rows[0];
  const currentStatus = raport.status as StatusRaport;

  // Check if the transition is valid according to the state machine
  const allowedTransitions = TRANSISI_VALID[currentStatus];
  if (!allowedTransitions?.includes(keStatus)) {
    return {
      boleh: false,
      alasan: `Transisi dari '${currentStatus}' ke '${keStatus}' tidak valid. Status yang diizinkan: ${allowedTransitions?.join(', ') || 'tidak ada'}`
    };
  }

  // Special validation for 'dikonfirmasi': all nilai mapel must be confirmed by guru
  // and all must have been opened for review
  if (keStatus === 'dikonfirmasi') {
    const belumKonfirmasi = await query(
      `SELECT COUNT(*) as count FROM data_raport_nilai_mapel
       WHERE data_raport_id = $1 AND dikonfirmasi_guru = false`,
      [dataRaportId]
    );
    if (Number(belumKonfirmasi.rows[0].count) > 0) {
      return {
        boleh: false,
        alasan: `Masih ada ${belumKonfirmasi.rows[0].count} nilai mapel yang belum dikonfirmasi guru`
      };
    }

    const belumDibukaReview = await query(
      `SELECT COUNT(*) as count FROM data_raport_nilai_mapel
       WHERE data_raport_id = $1 AND deskripsi_dibuka_untuk_review = false`,
      [dataRaportId]
    );
    if (Number(belumDibukaReview.rows[0].count) > 0) {
      return {
        boleh: false,
        alasan: `Masih ada ${belumDibukaReview.rows[0].count} nilai mapel yang belum dibuka untuk review`
      };
    }
  }

  // Special validation for 'difinalisasi': sikap and catatan_wali_kelas must be filled
  if (keStatus === 'difinalisasi') {
    if (!raport.sikap_id) {
      return { boleh: false, alasan: 'Penilaian sikap belum diisi' };
    }
    if (!raport.catatan_wali_kelas || raport.catatan_wali_kelas.trim() === '') {
      return { boleh: false, alasan: 'Catatan wali kelas belum diisi' };
    }
  }

  return { boleh: true };
}

/**
 * Changes the raport status and records the transition in history.
 * This is the ONLY pathway for changing data_raport.status.
 *
 * @param dataRaportId - The raport ID to transition
 * @param keStatus - The target status
 * @param changedBy - User ID who made the change
 * @param changedByRole - Role of the user making the change
 * @returns Result with success status and error message if failed
 */
export async function ubahStatus(
  dataRaportId: string,
  keStatus: StatusRaport,
  changedBy: string,
  changedByRole?: RoleChangedBy
): Promise<{ success: boolean; error?: string }> {
  // Validate the transition
  const cek = await bisaTransisi(dataRaportId, keStatus);
  if (!cek.boleh) {
    return { success: false, error: cek.alasan };
  }

  // Get current raport data for notifications
  const raportRes = await query(
    `SELECT dr.*, s.nama_siswa, c.nama_kelas, tr.nama_template
     FROM data_raport dr
     JOIN students s ON s.id = dr.siswa_id
     JOIN classes c ON c.id = dr.kelas_id
     JOIN template_raport tr ON tr.id = dr.template_raport_id
     WHERE dr.id = $1`,
    [dataRaportId]
  );
  const raport = raportRes.rows[0];

  // Update the status
  await query(
    `UPDATE data_raport SET status = $1, updated_at = now() WHERE id = $2`,
    [keStatus, dataRaportId]
  );

  // Record the transition in history (append-only)
  await query(
    `INSERT INTO data_raport_status_history (data_raport_id, status, changed_by, changed_by_role)
     VALUES ($1, $2, $3, $4)`,
    [dataRaportId, keStatus, changedBy, changedByRole || null]
  );

  // Send notifications based on the new status
  try {
    await sendRaportNotification({
      event: keStatus as RaportStatusEvent,
      raportId: dataRaportId,
      raport: {
        siswaNama: raport.nama_siswa,
        kelasNama: raport.nama_kelas,
        templateNama: raport.nama_template,
        periode: raport.periode,
      },
      kelasId: raport.kelas_id,
      changedBy,
    });
  } catch (err) {
    console.error('Failed to send raport notification:', err);
    // Don't fail the status change if notification fails
  }

  // If moving to difinalisasi, capture presensi snapshot
  if (keStatus === 'difinalisasi') {
    try {
      await snapshotPresensi(dataRaportId);
    } catch (err) {
      console.error('Failed to snapshot presensi:', err);
      // Don't fail the status change if snapshot fails
    }
  }

  return { success: true };
}

/**
 * Checks if nilai has changed after raport was confirmed/finalized.
 * This triggers notifications towali kelas without changing status.
 */
export async function handleNilaiBerubahSetelahKonfirmasi(
  kelasId: string,
  mapelId: string,
  siswaId: string
): Promise<void> {
  // Find affected raports in confirmed or finalized status
  const terdampak = await query(
    `SELECT dr.id, dr.status, dr.kelas_id, dr.periode
     FROM data_raport dr
     JOIN data_raport_nilai_mapel nm ON nm.data_raport_id = dr.id
     WHERE dr.kelas_id = $1 AND dr.siswa_id = $2 AND nm.mapel_id = $3
       AND dr.status IN ('dikonfirmasi', 'difinalisasi')`,
    [kelasId, siswaId, mapelId]
  );

  if (!terdampak.rows.length) return;

  // Get tahun ajaran aktif
  let tahunAjaran = '';
  let semester: 'ganjil' | 'genap' = 'ganjil';

  try {
    const ta = await getActiveTahunAjaran();
    if (ta) {
      tahunAjaran = ta.nama;
      semester = getCurrentSemester();
    }
  } catch {
    // Fallback to extracting from raport periode
    tahunAjaran = '';
    semester = 'ganjil';
  }

  // Get wali kelas for this class
  const waliKelas = tahunAjaran
    ? await getWaliKelasForKelas(kelasId, tahunAjaran, semester)
    : null;

  if (!waliKelas?.guru) return;

  // Get raport details for the notification
  for (const row of terdampak.rows) {
    try {
      await sendRaportNotification({
        event: 'nilai_diubah_setelah_konfirmasi',
        raportId: row.id,
        raport: {
          siswaNama: '',
          kelasNama: '',
          templateNama: '',
          periode: row.periode,
        },
        kelasId: row.kelas_id,
        changedBy: 'system',
      });
    } catch (err) {
      console.error('Failed to send nilai changed notification:', err);
    }
  }
}

export async function validateGuruMapelMember(memberId: string): Promise<boolean> {
  const res = await query(
    `SELECT validate_guru_mapel_member($1) as is_valid`,
    [memberId]
  );
  return res.rows[0]?.is_valid === true;
}

export async function createDataRaport(input: CreateDataRaportInput): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  const parsed = CreateDataRaportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  const { siswaId, nisn, nisLokal, kelasId, templateRaportId, periode, jenisLaporan } = parsed.data;

  const existRes = await query(
    `SELECT id FROM data_raport
     WHERE siswa_id = $1 AND template_raport_id = $2 AND periode = $3`,
    [siswaId, templateRaportId, periode]
  );

  if (existRes.rows.length > 0) {
    return { success: false, error: 'Raport untuk siswa ini sudah ada pada periode tersebut' };
  }

  try {
    const res = await query(
      `INSERT INTO data_raport
         (siswa_id, nisn, nis_lokal, kelas_id, template_raport_id, periode, jenis_laporan, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
       RETURNING id`,
      [siswaId, nisn, nisLokal, kelasId, templateRaportId, periode, jenisLaporan]
    );

    const id = res.rows[0].id;

    await query(
      `INSERT INTO data_raport_status_history (data_raport_id, status, changed_by)
       VALUES ($1, 'draft', $2)`,
      [id, '00000000-0000-0000-0000-000000000000']
    );

    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateNilaiMapel(input: UpdateNilaiMapelInput): Promise<{
  success: boolean;
  error?: string;
}> {
  const parsed = UpdateNilaiMapelInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  const { dataRaportId, mapelId, guruMapelMemberId, nilaiAkhir, kkm, deskripsiCapaian, deskripsiSumberAI, deskripsiDibukaUntukReview, dikonfirmasiGuru } = parsed.data;

  const isGuru = await validateGuruMapelMember(guruMapelMemberId);
  if (!isGuru) {
    return { success: false, error: 'guru_mapel_member_id bukan role guru di institution-members' };
  }

  const existRes = await query(
    `SELECT id FROM data_raport_nilai_mapel
     WHERE data_raport_id = $1 AND mapel_id = $2`,
    [dataRaportId, mapelId]
  );

  const insertCols = ['data_raport_id', 'mapel_id', 'guru_mapel_member_id', 'nilai_akhir', 'kkm', 'deskripsi_capaian', 'dikonfirmasi_guru', 'deskripsi_sumber_ai', 'deskripsi_dibuka_untuk_review'];
  const insertVals = [dataRaportId, mapelId, guruMapelMemberId, nilaiAkhir, kkm, deskripsiCapaian || '', dikonfirmasiGuru || false, deskripsiSumberAI || false, deskripsiDibukaUntukReview || false];
  const insertParams = insertVals.map((_, i) => `$${i + 1}`).join(', ');

  if (existRes.rows.length === 0) {
    await query(
      `INSERT INTO data_raport_nilai_mapel (${insertCols.join(', ')})
       VALUES (${insertParams})`,
      insertVals
    );
  } else {
    const updates: string[] = ['updated_at = now()'];
    const values: any[] = [];
    let paramIdx = 1;

    if (nilaiAkhir !== undefined) {
      updates.push(`nilai_akhir = $${paramIdx++}`);
      values.push(nilaiAkhir);
    }
    if (kkm !== undefined) {
      updates.push(`kkm = $${paramIdx++}`);
      values.push(kkm);
    }
    if (deskripsiCapaian !== undefined) {
      updates.push(`deskripsi_capaian = $${paramIdx++}`);
      values.push(deskripsiCapaian);
    }
    if (dikonfirmasiGuru !== undefined) {
      updates.push(`dikonfirmasi_guru = $${paramIdx++}`);
      values.push(dikonfirmasiGuru);
    }
    if (deskripsiSumberAI !== undefined) {
      updates.push(`deskripsi_sumber_ai = $${paramIdx++}`);
      values.push(deskripsiSumberAI);
    }
    if (deskripsiDibukaUntukReview !== undefined) {
      updates.push(`deskripsi_dibuka_untuk_review = $${paramIdx++}`);
      values.push(deskripsiDibukaUntukReview);
    }

    values.push(dataRaportId, mapelId);

    await query(
      `UPDATE data_raport_nilai_mapel
       SET ${updates.join(', ')}
       WHERE data_raport_id = $${paramIdx++} AND mapel_id = $${paramIdx}`,
      values
    );
  }

  return { success: true };
}

/**
 * @deprecated Use `ubahStatus` instead. This function now delegates to `ubahStatus`.
 * Kept for backwards compatibility.
 */
export async function changeRaportStatus(input: ChangeStatusInput): Promise<{
  success: boolean;
  error?: string;
  validationErrors?: string[];
}> {
  const parsed = ChangeStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  const { dataRaportId, newStatus, changedBy, changedByRole } = parsed.data;

  // Delegate to the single source of truth: ubahStatus
  const result = await ubahStatus(
    dataRaportId,
    newStatus,
    changedBy,
    changedByRole
  );

  return {
    success: result.success,
    error: result.error,
  };
}

export async function getDataRaportById(id: string): Promise<any | null> {
  const res = await query(
    `SELECT dr.*,
            tr.nama_template, tr.mode_nilai_akademik, tr.basis_deskripsi,
            s.nama_siswa, c.nama_kelas
     FROM data_raport dr
     JOIN template_raport tr ON tr.id = dr.template_raport_id
     JOIN students s ON s.id = dr.siswa_id
     JOIN classes c ON c.id = dr.kelas_id
     WHERE dr.id = $1`,
    [id]
  );

  if (res.rows.length === 0) return null;

  const raport = res.rows[0];

  const nilaiMapelRes = await query(
    `SELECT dnrm.*, sb.nama_mapel
     FROM data_raport_nilai_mapel dnrm
     LEFT JOIN subjects sb ON sb.id = dnrm.mapel_id
     WHERE dnrm.data_raport_id = $1
     ORDER BY sb.nama_mapel ASC`,
    [id]
  );

  return {
    ...raport,
    nilai_mapel: nilaiMapelRes.rows,
  };
}

export async function getTemplateRaport(
  sekolahId: string,
  jalurRegulasi: string,
  jenjang: string,
  kurikulum: string,
  jenisLaporan: string
): Promise<any | null> {
  const res = await query(
    `SELECT * FROM template_raport
     WHERE sekolah_id = $1
       AND jalur_regulasi = $2
       AND jenjang = $3
       AND kurikulum = $4
       AND jenis_laporan = $5
     ORDER BY is_default DESC
     LIMIT 1`,
    [sekolahId, jalurRegulasi, jenjang, kurikulum, jenisLaporan]
  );

  return res.rows[0] || null;
}

export async function getStatusHistory(dataRaportId: string): Promise<StatusHistoryEntry[]> {
  const res = await query(
    `SELECT id, data_raport_id, status, changed_at, changed_by, changed_by_role
     FROM data_raport_status_history
     WHERE data_raport_id = $1
     ORDER BY changed_at ASC`,
    [dataRaportId]
  );

  return res.rows.map(row => ({
    id: row.id,
    dataRaportId: row.data_raport_id,
    status: row.status,
    changedAt: new Date(row.changed_at),
    changedBy: row.changed_by,
    changedByRole: row.changed_by_role,
  }));
}

export async function snapshotPresensi(dataRaportId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const raportRes = await query(
    `SELECT dr.siswa_id, dr.periode,
            s.class_id
     FROM data_raport dr
     JOIN students s ON s.id = dr.siswa_id
     WHERE dr.id = $1`,
    [dataRaportId]
  );

  if (raportRes.rows.length === 0) {
    return { success: false, error: 'Raport tidak ditemukan' };
  }

  const raport = raportRes.rows[0];

  // Format periode: "TS-2025/2026-Ganjil" / "AS-2025/2026-Ganjil"
  // Ambil rentang tahun ajaran (YYYY/YYYY) lalu cocokkan ke tahun_ajaran
  // berdasarkan tanggal_mulai .. tanggal_selesai, bukan cross-join longgar.
  const periodeParts = raport.periode.match(/(\d{4})\/(\d{4})-(\w+)/);
  if (!periodeParts) {
    return { success: false, error: 'Format periode tidak valid' };
  }

  const tahunMulai = parseInt(periodeParts[1], 10);
  const tahunSelesai = parseInt(periodeParts[2], 10);

  const presensiRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE sa.status = 'sakit') as sakit,
       COUNT(*) FILTER (WHERE sa.status = 'izin') as izin,
       COUNT(*) FILTER (WHERE sa.status = 'alpa') as alpa
     FROM student_attendance sa
     JOIN schedules sch ON sch.id = sa.schedule_id
     JOIN tahun_ajaran ta ON ta.tanggal_mulai <= sa.tanggal AND sa.tanggal <= ta.tanggal_selesai
     WHERE sa.student_id = $1
       AND sch.class_id = $2
       AND EXTRACT(YEAR FROM ta.tanggal_mulai) = $3
       AND EXTRACT(YEAR FROM ta.tanggal_selesai) = $4
     LIMIT 1`,
    [raport.siswa_id, raport.class_id, tahunMulai, tahunSelesai]
  );

  const snapshot = {
    sakit: parseInt(presensiRes.rows[0]?.sakit || '0'),
    izin: parseInt(presensiRes.rows[0]?.izin || '0'),
    alpa: parseInt(presensiRes.rows[0]?.alpa || '0'),
  };

  await query(
    `UPDATE data_raport
     SET presensi_snapshot = $1, updated_at = now()
     WHERE id = $2`,
    [JSON.stringify(snapshot), dataRaportId]
  );

  return { success: true };
}
