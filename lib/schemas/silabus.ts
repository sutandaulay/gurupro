/**
 * Silabus/ATP Schema
 * Zod schemas for Alur Tujuan Pembelajaran (Silabus Semester)
 * Follows Permendikdasmen No. 1/2026 and No. 13/2025
 *
 * Updated: 14 Juli 2026 - Character limits dan fallbacks untuk robust output
 * Reference: docs/ai-generation-standard.md
 */

import { z } from 'zod';
import { truncateText, PRESET_LIMITS, PRESET_FALLBACKS } from '@/lib/ai/validation-utils';

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
  topik: z.string()
    .min(1, 'Topik wajib diisi')
    .max(100, 'Topik maksimal 100 karakter')
    .transform(val => truncateText(val, 100)),
  tujuanPembelajaran: z.array(
    z.string()
      .min(1, 'Tujuan pembelajaran wajib diisi')
      .max(200, 'Maksimal 200 karakter')
      .transform(val => truncateText(val, 200))
  ).min(1, 'Minimal 1 tujuan pembelajaran').max(5, 'Maksimal 5 tujuan pembelajaran'),
  dimensiProfilLulusanTerhubung: z.array(z.string()).max(2).default([]),
  estimasiPertemuan: z.number().int().positive().default(2),
  estimasiMinggu: z.number().int().positive().default(1),
  kataKunciMateri: z.array(
    z.string()
      .max(50, 'Kata kunci maksimal 50 karakter')
      .transform(val => truncateText(val, 50))
  ).max(5).default([]),
  catatanKokurikuler: z.string()
    .max(300, 'Catatan kokurikuler maksimal 300 karakter')
    .transform(val => truncateText(val, 300))
    .nullable()
    .optional()
    .transform(val => val || null),
});

export const silabusOutputSchema = z.object({
  identitas: z.object({
    mataPelajaran: z.string().min(1, 'Mata pelajaran wajib diisi').default('Tidak tersedia'),
    fase: z.string().min(1, 'Fase wajib diisi').default('E'),
    kelas: z.string().min(1, 'Kelas wajib diisi').default('Kelas X'),
    semester: z.union([z.literal(1), z.literal(2)]).default(1),
    tahunAjaran: z.string().nullable().default(null),
  }),
  capaianPembelajaran: z.string()
    .min(1, 'Capaian pembelajaran wajib diisi')
    .max(2000, 'Capaian pembelajaran maksimal 2000 karakter')
    .transform(val => truncateText(val, 2000))
    .catch('Data capaian pembelajaran tidak tersedia'),
  alurTujuanPembelajaran: z.array(alurUnitSchema).min(1, 'Minimal 1 unit').default([]),
  totalEstimasi: z.object({
    totalPertemuan: z.number().int().nonnegative().default(0),
    totalMinggu: z.number().int().nonnegative().default(0),
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
