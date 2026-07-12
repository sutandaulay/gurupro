/**
 * Silabus/ATP Schema
 * Zod schemas for Alur Tujuan Pembelajaran (Silabus Semester)
 * Follows Permendikdasmen No. 1/2026 and No. 13/2025
 */

import { z } from 'zod';

// ============================================
// INPUT SCHEMAS (Form Input)
// ============================================

export const silabusInputSchema = z.object({
  mataPelajaran: z.string().min(1, 'Mata pelajaran wajib diisi'),
  fase: z.enum(['A', 'B', 'C', 'D', 'E', 'F'], {
    message: 'Fase wajib dipilih',
  }),
  kelas: z.string().min(1, 'Kelas wajib diisi'),
  semester: z.union([z.literal(1), z.literal(2)], {
    message: 'Semester wajib dipilih',
  }),
  capaianPembelajaran: z.string().optional(),
  jumlahMingguEfektif: z.number().int().min(1).max(52).default(18),
  tahunAjaran: z.string().optional(),
});

export type SilabusInput = z.infer<typeof silabusInputSchema>;

// ============================================
// OUTPUT SCHEMAS (AI Response)
// ============================================

export const alurUnitSchema = z.object({
  unitKe: z.number().int().positive(),
  topik: z.string().min(1),
  tujuanPembelajaran: z.array(z.string()).min(1),
  dimensiProfilLulusanTerhubung: z.array(z.string()).max(2),
  estimasiPertemuan: z.number().int().positive(),
  estimasiMinggu: z.number().int().positive(),
  kataKunciMateri: z.array(z.string()).max(5),
  catatanKokurikuler: z.string().nullable().optional(),
});

export const silabusOutputSchema = z.object({
  identitas: z.object({
    mataPelajaran: z.string(),
    fase: z.string(),
    kelas: z.string(),
    semester: z.number(),
    tahunAjaran: z.string().nullable(),
  }),
  capaianPembelajaran: z.string(),
  alurTujuanPembelajaran: z.array(alurUnitSchema).min(1),
  totalEstimasi: z.object({
    totalPertemuan: z.number(),
    totalMinggu: z.number(),
  }),
});

export type SilabusOutput = z.infer<typeof silabusOutputSchema>;
export type AlurUnit = z.infer<typeof alurUnitSchema>;

// ============================================
// FORM SCHEMA (Combined with Kurikulum Options)
// ============================================

export const silabusFormInputSchema = z.object({
  // Basic Info
  mataPelajaran: z.string().min(1, 'Mata pelajaran wajib diisi'),
  subject_id: z.string().optional(),
  fase: z.enum(['A', 'B', 'C', 'D', 'E', 'F'], {
    message: 'Fase wajib dipilih',
  }),
  kelas: z.string().min(1, 'Kelas wajib diisi'),
  semester: z.union([z.literal(1), z.literal(2)], {
    message: 'Semester wajib dipilih',
  }),

  // Kurikulum Options
  kurikulum: z.enum(['merdeka', 'k13', 'kbc', 'hybrid']).default('merdeka'),
  dimensi8: z.array(z.string()).default([]),
  tiga_pengalaman: z.boolean().default(false),

  // AI Generation Options
  capaianPembelajaran: z.string().optional(),
  jumlahMingguEfektif: z.number().int().min(1).max(52).default(18),
  tahunAjaran: z.string().optional(),

  // School Context
  school_id: z.string().optional(),
  school_name: z.string().optional(),
  school_npsn: z.string().optional(),
  jenjang: z.string().default('SMA'),

  // PAI Mode (optional)
  pai_mode: z.enum(['none', 'spiritual_only', 'hybrid_kbc']).optional(),
});

export type SilabusFormInput = z.infer<typeof silabusFormInputSchema>;

// ============================================
// DATABASE STORAGE SCHEMA
// ============================================

export const silabusStorageSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  tipe_dokumen: z.literal('silabus'),
  judul_dokumen: z.string(),
  konten: z.object({
    identitas: silabusOutputSchema.shape.identitas,
    capaianPembelajaran: z.string(),
    alurTujuanPembelajaran: z.array(alurUnitSchema),
    totalEstimasi: silabusOutputSchema.shape.totalEstimasi,
    generated_with_ai: z.boolean().default(true),
    aiGeneratedFields: z.record(z.string(), z.boolean()).optional(),
    pdf_url: z.string().nullable().optional(),
    docx_url: z.string().nullable().optional(),
    pptx_url: z.string().nullable().optional(),
  }),
  school_id: z.string().nullable().optional(),
  subject_id: z.string().nullable().optional(),
  jenjang: z.string().nullable().optional(),
  kurikulum: z.string().nullable().optional(),
  fase: z.string().nullable().optional(),
  semester: z.number().nullable().optional(),
  dimensi8: z.array(z.string()).default([]),
  tahunAjaran: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type SilabusStorage = z.infer<typeof silabusStorageSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert AI output to storage format
 */
export function silabusOutputToStorage(
  output: SilabusOutput,
  metadata: {
    user_id: string;
    judul_dokumen: string;
    pdf_url?: string | null;
    docx_url?: string | null;
  }
): SilabusStorage['konten'] {
  return {
    identitas: output.identitas,
    capaianPembelajaran: output.capaianPembelajaran,
    alurTujuanPembelajaran: output.alurTujuanPembelajaran,
    totalEstimasi: output.totalEstimasi,
    generated_with_ai: true,
    pdf_url: metadata.pdf_url ?? null,
    docx_url: metadata.docx_url ?? null,
  };
}

/**
 * Calculate total from units
 */
export function calculateTotalEstimasi(units: AlurUnit[]): { totalPertemuan: number; totalMinggu: number } {
  return units.reduce(
    (acc, unit) => ({
      totalPertemuan: acc.totalPertemuan + unit.estimasiPertemuan,
      totalMinggu: acc.totalMinggu + unit.estimasiMinggu,
    }),
    { totalPertemuan: 0, totalMinggu: 0 }
  );
}

/**
 * Validate total weeks match expected
 */
export function validateMingguEfektif(
  units: AlurUnit[],
  expectedMinggu: number,
  tolerance: number = 2
): { valid: boolean; totalMinggu: number; difference: number } {
  const totalMinggu = units.reduce((acc, u) => acc + u.estimasiMinggu, 0);
  const difference = Math.abs(totalMinggu - expectedMinggu);

  return {
    valid: difference <= tolerance,
    totalMinggu,
    difference,
  };
}

// ============================================
// FASE LABELS
// ============================================

export const FASE_LABELS: Record<string, { jenjang: string; kelas: string }> = {
  A: { jenjang: 'SD', kelas: 'Kelas 1-2' },
  B: { jenjang: 'SD', kelas: 'Kelas 3' },
  C: { jenjang: 'SD', kelas: 'Kelas 4-6' },
  D: { jenjang: 'SMP', kelas: 'Kelas 7-9' },
  E: { jenjang: 'SMA', kelas: 'Kelas 10-11' },
  F: { jenjang: 'SMA/SMK', kelas: 'Kelas 12' },
};

// ============================================
// DEFAULT MINGGU EFEKTIF
// ============================================

export const DEFAULT_MINGGU_EFEKTIF = 18; // Standard semester length

export const SEMESTER_BUFFER = {
  1: { start: 'Juli', end: 'Desember', pts: 8, pas: 17 }, // Ganjil
  2: { start: 'Januari', end: 'Juni', pts: 8, pas: 16 }, // Genap
};
