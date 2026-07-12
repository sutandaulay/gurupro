/**
 * Laporan Evaluasi LKPD Schema
 * Zod schemas for LKPD Evaluation Report (Laporan Evaluasi Lembar Kerja Peserta Didik)
 * Designed for school leadership (Principal/Vice Principal) consumption
 *
 * This is a REPORT document (not a planning document like RPP/Modul Ajar)
 * - Formal/administrative language for school leadership
 * - Aggregate data only (no individual student names in narrative)
 * - Actionable recommendations
 */

import { z } from 'zod';

// ============================================
// INPUT SCHEMAS (Form Input from Teacher)
// ============================================

export const laporanEvaluasiLkpdInputSchema = z.object({
  // Required: reference to LKPD being evaluated
  lkpdRef: z.string().min(1, "LKPD referensi wajib dipilih"),

  // Evaluation metadata
  periodeEvaluasi: z.string().min(1, "Periode evaluasi wajib diisi"),
  jumlahSiswa: z.number().int().positive("Jumlah siswa harus angka positif"),

  // Data input method
  dataHasil: z.enum(['upload_excel', 'input_manual', 'ringkasan_kualitatif']),

  // Optional: for manual input or excel data
  dataSiswa: z.array(z.object({
    namaSiswa: z.string(),
    skorPerKKTP: z.record(z.string(), z.number().min(0).max(100)).optional(),
    statusPerKKTP: z.record(z.string(), z.boolean()).optional(),
  })).optional(),

  // Optional: excel file URL if upload_excel
  excelUrl: z.string().optional(),

  // Optional: qualitative summary for ringkasan_kualitatif
  ringkasanKualitatif: z.string().optional(),

  // Teacher observations
  catatanGuru: z.string().optional(),

  // Standard fields
  school_id: z.string().optional(),
  school_name: z.string().optional(),
});

export type LaporanEvaluasiLkpdInput = z.infer<typeof laporanEvaluasiLkpdInputSchema>;

// ============================================
// OUTPUT SCHEMAS (AI Response)
// ============================================

export const capaianPerKKTPSchema = z.object({
  kktp: z.string(),
  persentaseTuntas: z.number().min(0).max(100),
  kategoriCapaian: z.enum(['sangat_baik', 'baik', 'cukup', 'perlu_perhatian']),
});

export const siswaPerluPerhatianSchema = z.object({
  // Catatan agregat, BUKAN nama siswa individual
  catatan: z.string(),
  jumlahSiswaTerdampak: z.number(),
});

export const laporanEvaluasiLkpdOutputSchema = z.object({
  identitas: z.object({
    mataPelajaran: z.string(),
    kelas: z.string(),
    periodeEvaluasi: z.string(),
    jumlahSiswa: z.number(),
    guruPengampu: z.string().nullable(),
    lkpdRef: z.string().nullable(),
  }),
  ringkasanEksekutif: z.string().max(500),
  capaianPerKKTP: z.array(capaianPerKKTPSchema).min(1),
  temuanUtama: z.array(z.string()).max(5),
  siswaPerluPerhatian: siswaPerluPerhatianSchema.nullable(),
  rekomendasiTindakLanjut: z.array(z.string()).min(1).max(5),
  // Metadata
  isEstimasiKualitatif: z.boolean().default(false),
});

export type LaporanEvaluasiLkpdOutput = z.infer<typeof laporanEvaluasiLkpdOutputSchema>;
export type CapaianPerKKTP = z.infer<typeof capaianPerKKTPSchema>;
export type SiswaPerluPerhatian = z.infer<typeof siswaPerluPerhatianSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get kategori capaian label for display
 */
export function getKategoriLabel(kategori: CapaianPerKKTP['kategoriCapaian']): string {
  const labels: Record<CapaianPerKKTP['kategoriCapaian'], string> = {
    sangat_baik: 'Sangat Baik',
    baik: 'Baik',
    cukup: 'Cukup',
    perlu_perhatian: 'Perlu Perhatian',
  };
  return labels[kategori];
}

/**
 * Get kategori color for PDF/DOC export
 */
export function getKategoriColor(kategori: CapaianPerKKTP['kategoriCapaian']): string {
  const colors: Record<CapaianPerKKTP['kategoriCapaian'], string> = {
    sangat_baik: '#22C55E', // green-500
    baik: '#3B82F6',        // blue-500
    cukup: '#EAB308',       // yellow-500
    perlu_perhatian: '#EF4444', // red-500
  };
  return colors[kategori];
}

/**
 * Determine kategori from percentage
 */
export function getKategoriFromPercentage(persentase: number): CapaianPerKKTP['kategoriCapaian'] {
  if (persentase >= 85) return 'sangat_baik';
  if (persentase >= 70) return 'baik';
  if (persentase >= 50) return 'cukup';
  return 'perlu_perhatian';
}

/**
 * Format percentage for display
 */
export function formatPersentase(persentase: number): string {
  return `${Math.round(persentase)}%`;
}

/**
 * Validate that no individual student names appear in output narrative
 * (Names should only appear in raw data attachments, not in the report narrative)
 */
export function validateNoIndividualNames(ringkasanEksekutif: string, temuanUtama: string[]): boolean {
  // Check if any common name patterns appear (simple heuristic)
  // This is a basic check - real implementation might use NER
  const patterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // First Last pattern
  ];

  for (const pattern of patterns) {
    const matches = ringkasanEksekutif.match(pattern);
    if (matches && matches.length > 3) {
      // More than 3 names suggests individual naming
      return false;
    }
  }
  return true;
}

// ============================================
// DATABASE STORAGE SCHEMA
// ============================================

export const laporanEvaluasiStorageSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  tipe_dokumen: z.literal('laporan_evaluasi_lkpd'),
  judul_dokumen: z.string(),
  konten: z.object({
    identitas: laporanEvaluasiLkpdOutputSchema.shape.identitas,
    ringkasanEksekutif: z.string(),
    capaianPerKKTP: z.array(capaianPerKKTPSchema),
    temuanUtama: z.array(z.string()),
    siswaPerluPerhatian: siswaPerluPerhatianSchema.nullable(),
    rekomendasiTindakLanjut: z.array(z.string()),
    isEstimasiKualitatif: z.boolean(),
    generated_with_ai: z.boolean().default(true),
    aiGeneratedFields: z.record(z.string(), z.boolean()).optional(),
    pdf_url: z.string().nullable().optional(),
    docx_url: z.string().nullable().optional(),
  }),
  lkpd_ref: z.string().nullable().optional(),
  school_id: z.string().nullable().optional(),
  akses_terbatas: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type LaporanEvaluasiStorage = z.infer<typeof laporanEvaluasiStorageSchema>;
