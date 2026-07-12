/**
 * LKPD Schema
 * Zod schemas for Lembar Kerja Peserta Didik (Student Worksheet)
 * Follows Permendikdasmen No. 1/2026 and No. 13/2025
 *
 * LKPD is designed for STUDENTS (not teachers) - language must be age-appropriate
 * Focuses on 2-3 stages: Memahami (Understand) and/or Mengaplikasi (Apply)
 * Reflection stage is typically done verbally/in journal, not in LKPD
 */

import { z } from 'zod';

// ============================================
// INPUT SCHEMAS (Form Input)
// ============================================

export const lkpdInputSchema = z.object({
  sumberData: z.enum(['dari_modul_ajar', 'manual']),
  // Jika dari_modul_ajar
  modulAjarId: z.string().optional(),
  // Jika manual
  mataPelajaran: z.string().optional(),
  fase: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
  topikUtama: z.string().optional(),
  tujuanPembelajaran: z.string().optional(),
  // Field baru
  jenisAktivitas: z.enum(['individu', 'kelompok']),
  tahapFokus: z.enum(['memahami', 'mengaplikasi', 'gabungan']),
  // Field standar
  jenjang: z.string().optional(),
  kelas: z.string().optional(),
  kurikulum: z.enum(['merdeka', 'k13', 'kbc', 'hybrid']).optional(),
});

export type LKPDInput = z.infer<typeof lkpdInputSchema>;

// ============================================
// OUTPUT SCHEMAS (AI Response)
// ============================================

export const aktivitasSchema = z.object({
  nomor: z.number().int().positive(),
  instruksi: z.string().min(1),
  tahap: z.enum(['memahami', 'mengaplikasi']),
  jenisRespon: z.enum(['isian_singkat', 'uraian', 'tabel', 'gambar_diagram', 'checklist']),
  ruangJawabanBaris: z.number().int().min(1).max(10),
});

export const lkpdOutputSchema = z.object({
  identitas: z.object({
    mataPelajaran: z.string(),
    fase: z.string(),
    topik: z.string(),
    namaSiswa: z.string().nullable(),
    kelompok: z.string().nullable(),
  }),
  petunjukPengerjaan: z.array(z.string()).min(2).max(5),
  tujuanKegiatan: z.string(),
  aktivitas: z.array(aktivitasSchema).min(2),
  refleksiSingkat: z.array(z.string()).max(3),
});

export type LKPDOutput = z.infer<typeof lkpdOutputSchema>;
export type Aktivitas = z.infer<typeof aktivitasSchema>;

// ============================================
// FORM SCHEMA (Combined)
// ============================================

export const lkpdFormInputSchema = z.object({
  // Sumber Data
  sumberData: z.enum(['dari_modul_ajar', 'manual']),

  // Jika dari_modul_ajar
  modulAjarId: z.string().optional(),

  // Jika manual
  mataPelajaran: z.string().optional(),
  fase: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
  topikUtama: z.string().optional(),
  tujuanPembelajaran: z.string().optional(),

  // Field baru per spec
  jenisAktivitas: z.enum(['individu', 'kelompok']),
  tahapFokus: z.enum(['memahami', 'mengaplikasi', 'gabungan']),

  // Field standar
  jenjang: z.string().default('SMA'),
  kelas: z.string().optional(),
  kurikulum: z.enum(['merdeka', 'k13', 'kbc', 'hybrid']).default('merdeka'),
  school_id: z.string().optional(),
  school_name: z.string().optional(),
  school_npsn: z.string().optional(),
});

export type LKPDFormInput = z.infer<typeof lkpdFormInputSchema>;

// ============================================
// DATABASE STORAGE SCHEMA
// ============================================

export const lkpdStorageSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  tipe_dokumen: z.literal('lkpd'),
  judul_dokumen: z.string(),
  konten: z.object({
    identitas: lkpdOutputSchema.shape.identitas,
    petunjukPengerjaan: z.array(z.string()),
    tujuanKegiatan: z.string(),
    aktivitas: z.array(aktivitasSchema),
    refleksiSingkat: z.array(z.string()),
    generated_with_ai: z.boolean().default(true),
    aiGeneratedFields: z.record(z.string(), z.boolean()).optional(),
    pdf_url: z.string().nullable().optional(),
    docx_url: z.string().nullable().optional(),
  }),
  modulAjarRef: z.string().nullable().optional(),
  school_id: z.string().nullable().optional(),
  jenjang: z.string().nullable().optional(),
  kurikulum: z.string().nullable().optional(),
  fase: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type LKPDStorage = z.infer<typeof lkpdStorageSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert AI output to storage format
 */
export function lkpdOutputToStorage(
  output: LKPDOutput,
  metadata: {
    user_id: string;
    judul_dokumen: string;
    pdf_url?: string | null;
    docx_url?: string | null;
    modulAjarRef?: string | null;
  }
): LKPDStorage['konten'] {
  return {
    identitas: output.identitas,
    petunjukPengerjaan: output.petunjukPengerjaan,
    tujuanKegiatan: output.tujuanKegiatan,
    aktivitas: output.aktivitas,
    refleksiSingkat: output.refleksiSingkat,
    generated_with_ai: true,
    pdf_url: metadata.pdf_url ?? null,
    docx_url: metadata.docx_url ?? null,
  };
}

/**
 * Get tahap label for display
 */
export function getTahapLabel(tahap: 'memahami' | 'mengaplikasi'): string {
  return tahap === 'memahami' ? 'Memahami' : 'Mengaplikasi';
}

/**
 * Get jenisRespon label for display
 */
export function getJenisResponLabel(jenis: Aktivitas['jenisRespon']): string {
  const labels: Record<Aktivitas['jenisRespon'], string> = {
    isian_singkat: 'Isian Singkat',
    uraian: 'Uraian',
    tabel: 'Tabel',
    gambar_diagram: 'Gambar/Diagram',
    checklist: 'Checklist',
  };
  return labels[jenis];
}

/**
 * Validate aktivitas variety (not all same jenisRespon)
 */
export function validateAktivitasVariety(aktivitas: Aktivitas[]): boolean {
  const uniqueTypes = new Set(aktivitas.map(a => a.jenisRespon));
  return uniqueTypes.size >= 2;
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
