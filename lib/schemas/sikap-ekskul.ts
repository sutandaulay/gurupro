import { z } from 'zod';

// =====================================================
// Enums
// =====================================================

export const PredikatSikapEnum = z.enum(['sangat_baik', 'baik', 'cukup', 'perlu_bimbingan']);

export const DimensiPancasilaEnum = z.enum([
  'beriman_bertakwa',
  'berkebinekaan_global',
  'bergotong_royong',
  'mandiri',
  'bernalar_kritis',
  'kreatif',
]);

export const DimensiProfilLulusanMadrasahEnum = z.enum([
  'keimanan_ketakwaan',
  'kewargaan',
  'penalaran_kritis',
  'kreativitas',
  'kolaborasi',
  'kemandirian',
  'kesehatan',
  'komunikasi',
]);

export const DimensiP2RAEnum = z.enum([
  'berkeadaban',
  'keteladanan',
  'kewarganegaraan',
  'tawassuth',
  'tawazun',
  'itidal',
  'musawah',
  'syura',
  'tasamuh',
  'dinamis_inovatif',
]);

export const VarianSikapInputEnum = z.enum(['profil_pelajar_pancasila', 'dimensi_profil_lulusan_madrasah', 'profil_rahmatan_lil_alamin']);

// =====================================================
// Types
// =====================================================

export type PredikatSikap = z.infer<typeof PredikatSikapEnum>;
export type DimensiPancasila = z.infer<typeof DimensiPancasilaEnum>;
export type DimensiProfilLulusanMadrasah = z.infer<typeof DimensiProfilLulusanMadrasahEnum>;
export type VarianSikapInput = z.infer<typeof VarianSikapInputEnum>;

export interface DimensiPredikat {
  dimensi: string;
  predikat: PredikatSikap;
}

// =====================================================
// Penilaian Sikap Schemas
// =====================================================

export const PenilaianSikapDimensiSchema = z.object({
  dimensi: z.string().min(1),
  predikat: PredikatSikapEnum,
});

export const PenilaianSikapCreateSchema = z.object({
  siswaId: z.string().uuid(),
  kelasId: z.string().uuid(),
  periode: z.string().min(1),
  varian: VarianSikapInputEnum,
  penilaianPerDimensi: z.array(PenilaianSikapDimensiSchema).min(1),
  deskripsiUmum: z.string().min(1),
});

export const PenilaianSikapUpdateSchema = z.object({
  id: z.string().uuid(),
  penilaianPerDimensi: z.array(PenilaianSikapDimensiSchema).min(1).optional(),
  deskripsiUmum: z.string().min(1).optional(),
});

export const PenilaianSikapRowSchema = z.object({
  id: z.string().uuid(),
  siswa_id: z.string().uuid(),
  kelas_id: z.string().uuid(),
  periode: z.string(),
  varian: z.string(),
  penilaian_per_dimensi: z.any(),
  deskripsi_umum: z.string(),
  dinilai_oleh: z.string().uuid(),
  created_at: z.string(),
});

export const PenilaianSikapResponseSchema = z.object({
  id: z.string().uuid(),
  siswaId: z.string().uuid(),
  kelasId: z.string().uuid(),
  periode: z.string(),
  varian: VarianSikapInputEnum,
  penilaianPerDimensi: z.array(PenilaianSikapDimensiSchema),
  deskripsiUmum: z.string(),
  dinilaiOleh: z.string().uuid(),
  createdAt: z.string(),
});

export type PenilaianSikapCreate = z.infer<typeof PenilaianSikapCreateSchema>;
export type PenilaianSikapUpdate = z.infer<typeof PenilaianSikapUpdateSchema>;
export type PenilaianSikapRow = z.infer<typeof PenilaianSikapRowSchema>;
export type PenilaianSikapResponse = z.infer<typeof PenilaianSikapResponseSchema>;

// =====================================================
// Ekstrakurikuler Schemas
// =====================================================

export const EkstrakurikulerCreateSchema = z.object({
  namaEkskul: z.string().min(1).max(255),
  kelasId: z.string().uuid(),
  pembinaMemberId: z.string().uuid(),
});

export const EkstrakurikulerUpdateSchema = z.object({
  id: z.string().uuid(),
  namaEkskul: z.string().min(1).max(255).optional(),
  pembinaMemberId: z.string().uuid().optional(),
});

export const EkstrakurikulerRowSchema = z.object({
  id: z.string().uuid(),
  nama_ekskul: z.string(),
  kelas_id: z.string().uuid(),
  pembina_member_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const EkstrakurikulerResponseSchema = z.object({
  id: z.string().uuid(),
  namaEkskul: z.string(),
  kelasId: z.string().uuid(),
  pembinaMemberId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type EkstrakurikulerCreate = z.infer<typeof EkstrakurikulerCreateSchema>;
export type EkstrakurikulerUpdate = z.infer<typeof EkstrakurikulerUpdateSchema>;
export type EkstrakurikulerRow = z.infer<typeof EkstrakurikulerRowSchema>;
export type EkstrakurikulerResponse = z.infer<typeof EkstrakurikulerResponseSchema>;

// =====================================================
// Penilaian Ekstrakurikuler Schemas
// =====================================================

export const PenilaianEkstrakurikulerCreateSchema = z.object({
  siswaId: z.string().uuid(),
  ekstrakurikulerId: z.string().uuid(),
  periode: z.string().min(1),
  predikat: PredikatSikapEnum,
  deskripsi: z.string().min(1),
});

export const PenilaianEkstrakurikulerUpdateSchema = z.object({
  id: z.string().uuid(),
  predikat: PredikatSikapEnum.optional(),
  deskripsi: z.string().min(1).optional(),
});

export const PenilaianEkstrakurikulerRowSchema = z.object({
  id: z.string().uuid(),
  siswa_id: z.string().uuid(),
  ekstrakurikuler_id: z.string().uuid(),
  periode: z.string(),
  predikat: z.string(),
  deskripsi: z.string(),
  dinilai_oleh: z.string().uuid(),
  created_at: z.string(),
});

export const PenilaianEkstrakurikulerResponseSchema = z.object({
  id: z.string().uuid(),
  siswaId: z.string().uuid(),
  ekstrakurikulerId: z.string().uuid(),
  periode: z.string(),
  predikat: PredikatSikapEnum,
  deskripsi: z.string(),
  dinilaiOleh: z.string().uuid(),
  createdAt: z.string(),
});

export type PenilaianEkstrakurikulerCreate = z.infer<typeof PenilaianEkstrakurikulerCreateSchema>;
export type PenilaianEkstrakurikulerUpdate = z.infer<typeof PenilaianEkstrakurikulerUpdateSchema>;
export type PenilaianEkstrakurikulerRow = z.infer<typeof PenilaianEkstrakurikulerRowSchema>;
export type PenilaianEkstrakurikulerResponse = z.infer<typeof PenilaianEkstrakurikulerResponseSchema>;

// =====================================================
// Catatan Wali Kelas Schemas
// =====================================================

export const CatatanWaliKelasCreateSchema = z.object({
  siswaId: z.string().uuid(),
  kelasId: z.string().uuid(),
  periode: z.string().min(1),
  catatan: z.string().min(1),
});

export const CatatanWaliKelasUpdateSchema = z.object({
  id: z.string().uuid(),
  catatan: z.string().min(1),
});

export const CatatanWaliKelasRowSchema = z.object({
  id: z.string().uuid(),
  siswa_id: z.string().uuid(),
  kelas_id: z.string().uuid(),
  periode: z.string(),
  catatan: z.string(),
  ditulis_oleh: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CatatanWaliKelasResponseSchema = z.object({
  id: z.string().uuid(),
  siswaId: z.string().uuid(),
  kelasId: z.string().uuid(),
  periode: z.string(),
  catatan: z.string(),
  ditulisOleh: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CatatanWaliKelasCreate = z.infer<typeof CatatanWaliKelasCreateSchema>;
export type CatatanWaliKelasUpdate = z.infer<typeof CatatanWaliKelasUpdateSchema>;
export type CatatanWaliKelasRow = z.infer<typeof CatatanWaliKelasRowSchema>;
export type CatatanWaliKelasResponse = z.infer<typeof CatatanWaliKelasResponseSchema>;

// =====================================================
// Query Filters
// =====================================================

export const PenilaianSikapQuerySchema = z.object({
  siswaId: z.string().uuid().optional(),
  kelasId: z.string().uuid().optional(),
  periode: z.string().optional(),
  varian: VarianSikapInputEnum.optional(),
  dinilaiOleh: z.string().uuid().optional(),
});

export const EkstrakurikulerQuerySchema = z.object({
  kelasId: z.string().uuid().optional(),
  pembinaMemberId: z.string().uuid().optional(),
  schoolId: z.string().uuid().optional(),
});

export const PenilaianEkstrakurikulerQuerySchema = z.object({
  siswaId: z.string().uuid().optional(),
  ekstrakurikulerId: z.string().uuid().optional(),
  periode: z.string().optional(),
  dinilaiOleh: z.string().uuid().optional(),
});

export const CatatanWaliKelasQuerySchema = z.object({
  siswaId: z.string().uuid().optional(),
  kelasId: z.string().uuid().optional(),
  periode: z.string().optional(),
  ditulisOleh: z.string().uuid().optional(),
});

export type PenilaianSikapQuery = z.infer<typeof PenilaianSikapQuerySchema>;
export type EkstrakurikulerQuery = z.infer<typeof EkstrakurikulerQuerySchema>;
export type PenilaianEkstrakurikulerQuery = z.infer<typeof PenilaianEkstrakurikulerQuerySchema>;
export type CatatanWaliKelasQuery = z.infer<typeof CatatanWaliKelasQuerySchema>;
