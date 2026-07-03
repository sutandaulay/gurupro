/**
 * Evidence Auto-Logger
 * Automatically logs teacher activities as evidence for performance reporting
 */

import { query } from '@/lib/db'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type EvidenceKategori =
  | 'perencanaan' | 'pelaksanaan' | 'penilaian' | 'evaluasi'
  | 'tindak_lanjut' | 'refleksi' | 'kolaborasi_ortu'
  | 'pengembangan_diri' | 'inovasi'

export interface LogEvidenceInput {
  guruId: string
  tahunAjaranId: string
  semester: 'ganjil' | 'genap'
  kategori: EvidenceKategori
  subKategori: string
  referensiId?: string
  referensiTabel?: string
  judul: string
  deskripsi?: string
  tanggalAktivitas: Date
  metadata?: Record<string, unknown>
}

// ─── MAPPING: aktivitas → indikator kinerja ──────────────────────────────────

const INDIKATOR_MAP: Record<string, string[]> = {
  'perencanaan:prota':              ['IK-01'],
  'perencanaan:promes':             ['IK-01'],
  'perencanaan:atp':                ['IK-01', 'IK-02'],
  'perencanaan:modul_ajar':         ['IK-01', 'IK-02'],
  'pelaksanaan:jurnal_mengajar':    ['IK-03', 'IK-04'],
  'pelaksanaan:satu_klik':          ['IK-03', 'IK-04'],
  'refleksi:jurnal_refleksi':      ['IK-08'],
  'penilaian:bank_soal':            ['IK-05'],
  'penilaian:input_nilai':          ['IK-05', 'IK-06'],
  'evaluasi:analisis_kelas':        ['IK-06'],
  'tindak_lanjut:remedial':         ['IK-07'],
  'tindak_lanjut:pengayaan':       ['IK-07'],
  'kolaborasi_ortu:pesan_wa':       ['IK-09'],
  'kolaborasi_ortu:pertemuan':      ['IK-09'],
  'pengembangan_diri:pelatihan':    ['IK-10'],
  'pengembangan_diri:komunitas':    ['IK-11'],
  'pengembangan_diri:sertifikat':   ['IK-10', 'IK-11'],
  'inovasi:media_pembelajaran':     ['IK-12'],
  'inovasi:proyek_p5':             ['IK-12'],
}

// ─── BOBOT per jenis aktivitas ───────────────────────────────────────────────

const BOBOT_MAP: Record<string, number> = {
  'prota': 3, 'promes': 3, 'atp': 3,
  'modul_ajar': 3,
  'jurnal_mengajar': 1, 'satu_klik': 1,
  'bank_soal': 2, 'input_nilai': 2,
  'remedial': 3, 'pengayaan': 2,
  'analisis_kelas': 2,
  'pesan_wa': 1, 'pertemuan': 2,
  'pelatihan': 5,
  'komunitas': 3,
  'sertifikat': 4,
  'media_pembelajaran': 3,
  'proyek_p5': 4,
  'jurnal_refleksi': 2,
}

// ─── MAIN LOGGER ─────────────────────────────────────────────────────────────

/**
 * Log evidence for a teacher activity
 * Fire-and-forget - does not block main operation
 */
export async function logEvidence(input: LogEvidenceInput): Promise<void> {
  const mapKey = `${input.kategori}:${input.subKategori}`
  const indikator = INDIKATOR_MAP[mapKey] ?? []
  const bobot = BOBOT_MAP[input.subKategori] ?? 1

  try {
    await query(
      `INSERT INTO evidence_log (
        guru_id, tahun_ajaran_id, semester, kategori, sub_kategori,
        referensi_id, referensi_tabel, judul, deskripsi,
        indikator_kinerja, bobot_evidence, tanggal_aktivitas, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT DO NOTHING`,
      [
        input.guruId,
        input.tahunAjaranId,
        input.semester,
        input.kategori,
        input.subKategori,
        input.referensiId ?? null,
        input.referensiTabel ?? null,
        input.judul,
        input.deskripsi ?? null,
        indikator,
        bobot,
        input.tanggalAktivitas.toISOString().split('T')[0],
        JSON.stringify(input.metadata ?? {}),
      ]
    )
  } catch (err) {
    // Fire-and-forget - never crash main operation
    console.error('[evidence-logger] Failed to log evidence:', err)
  }
}

// ─── HELPER: Log from RPP/Modul Ajar creation ────────────────────────────────

export async function logModulAjarEvidence(params: {
  guruId: string
  tahunAjaranId: string
  semester: 'ganjil' | 'genap'
  rppId: string
  judul: string
  mapel: string
  kelas: string
  tanggal: Date
}) {
  await logEvidence({
    guruId: params.guruId,
    tahunAjaranId: params.tahunAjaranId,
    semester: params.semester,
    kategori: 'perencanaan',
    subKategori: 'modul_ajar',
    referensiId: params.rppId,
    referensiTabel: 'guru_administrasi',
    judul: params.judul,
    deskripsi: `${params.mapel}, ${params.kelas}`,
    tanggalAktivitas: params.tanggal,
    metadata: { mapel: params.mapel, kelas: params.kelas },
  })
}

// ─── HELPER: Log from Journal creation ───────────────────────────────────────

export async function logJournalEvidence(params: {
  guruId: string
  tahunAjaranId: string
  semester: 'ganjil' | 'genap'
  journalId: string
  mapel: string
  kelas: string
  tanggal: Date
  jumlahHadir: number
  hasReflection: boolean
}) {
  // Log journal entry
  await logEvidence({
    guruId: params.guruId,
    tahunAjaranId: params.tahunAjaranId,
    semester: params.semester,
    kategori: 'pelaksanaan',
    subKategori: 'jurnal_mengajar',
    referensiId: params.journalId,
    referensiTabel: 'teacher_journals',
    judul: `Jurnal: ${params.mapel} ${params.kelas} — ${formatDate(params.tanggal)}`,
    tanggalAktivitas: params.tanggal,
    metadata: { jumlah_hadir: params.jumlahHadir },
  })

  // Log reflection if exists
  if (params.hasReflection) {
    await logEvidence({
      guruId: params.guruId,
      tahunAjaranId: params.tahunAjaranId,
      semester: params.semester,
      kategori: 'refleksi',
      subKategori: 'jurnal_refleksi',
      referensiId: params.journalId,
      referensiTabel: 'teacher_journals',
      judul: `Refleksi: ${params.mapel} ${params.kelas} — ${formatDate(params.tanggal)}`,
      tanggalAktivitas: params.tanggal,
    })
  }
}

// ─── HELPER: Log from Satu Klik Selesai ─────────────────────────────────────

export async function logSatuKlikEvidence(params: {
  guruId: string
  tahunAjaranId: string
  semester: 'ganjil' | 'genap'
  sessionId: string
  mapel: string
  kelas: string
  tanggal: Date
  attendanceData: {
    jumlah_hadir: number
    jumlah_izin: number
    jumlah_sakit: number
    jumlah_alpha: number
  }
}) {
  await logEvidence({
    guruId: params.guruId,
    tahunAjaranId: params.tahunAjaranId,
    semester: params.semester,
    kategori: 'pelaksanaan',
    subKategori: 'satu_klik',
    referensiId: params.sessionId,
    referensiTabel: 'teaching_sessions',
    judul: `Selesai Mengajar: ${params.mapel} ${params.kelas} — ${formatDate(params.tanggal)}`,
    tanggalAktivitas: params.tanggal,
    metadata: {
      mapel: params.mapel,
      kelas: params.kelas,
      ...params.attendanceData,
    },
  })
}

// ─── HELPER: Log from Pelatihan creation ─────────────────────────────────────

export async function logPelatihanEvidence(params: {
  guruId: string
  tahunAjaranId: string
  semester: 'ganjil' | 'genap'
  pelatihanId: string
  namaPelatihan: string
  penyelenggara: string
  jenis: string
  lingkup: string
  durasiJam: number
  tanggalMulai: Date
  kompetensi: string[]
  adaSertifikat: boolean
}) {
  await logEvidence({
    guruId: params.guruId,
    tahunAjaranId: params.tahunAjaranId,
    semester: params.semester,
    kategori: 'pengembangan_diri',
    subKategori: 'pelatihan',
    referensiId: params.pelatihanId,
    referensiTabel: 'pelatihan_guru',
    judul: `Pelatihan: ${params.namaPelatihan}`,
    deskripsi: `${params.penyelenggara} · ${params.durasiJam} jam · ${params.lingkup}`,
    tanggalAktivitas: params.tanggalMulai,
    metadata: {
      jenis: params.jenis,
      lingkup: params.lingkup,
      durasi_jam: params.durasiJam,
      ada_sertifikat: params.adaSertifikat,
      kompetensi: params.kompetensi,
    },
  })
}

// ─── HELPER: Log from Remedial ───────────────────────────────────────────────

export async function logRemedialEvidence(params: {
  guruId: string
  tahunAjaranId: string
  semester: 'ganjil' | 'genap'
  remedialId: string
  mapel: string
  kelas: string
  jumlahSiswa: number
  tanggal: Date
}) {
  await logEvidence({
    guruId: params.guruId,
    tahunAjaranId: params.tahunAjaranId,
    semester: params.semester,
    kategori: 'tindak_lanjut',
    subKategori: 'remedial',
    referensiId: params.remedialId,
    referensiTabel: 'student_grades',
    judul: `Remedial: ${params.mapel} ${params.kelas} — ${params.jumlahSiswa} siswa`,
    deskripsi: `${params.jumlahSiswa} siswa membutuhkan remedial`,
    tanggalAktivitas: params.tanggal,
    metadata: { mapel: params.mapel, kelas: params.kelas, jumlah_siswa: params.jumlahSiswa },
  })
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── GET SEMESTER FROM DATE ──────────────────────────────────────────────────

export function getSemesterFromDate(date: Date): 'ganjil' | 'genap' {
  const month = date.getMonth() + 1 // 1-12
  // Ganjil: July-December (7-12), Genap: January-June (1-6)
  return month >= 7 ? 'ganjil' : 'genap'
}

// ─── GET AKTIF TAHUN AJARAN ──────────────────────────────────────────────────

export async function getAktifTahunAjaran(): Promise<{ id: string; nama: string } | null> {
  try {
    const result = await query(
      `SELECT id, nama FROM tahun_ajaran WHERE is_active = true LIMIT 1`
    )
    if (result.rows.length > 0) {
      return result.rows[0]
    }
    return null
  } catch {
    return null
  }
}
