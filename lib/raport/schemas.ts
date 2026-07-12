import { z } from 'zod';

export const JalurRegulasiEnum = z.enum(['kemendikdasmen', 'kemenag']);
export const KurikulumEnum = z.enum(['kurikulum_merdeka', 'k13', 'kbc', 'hybrid']);
export const JenisLaporanEnum = z.enum(['tengah_semester', 'akhir_semester', 'kokurikuler_p5', 'kokurikuler_p2ra']);
export const JenjangEnum = z.enum(['paud', 'sd_mi', 'smp_mts', 'sma_ma', 'smk_mak']);
export const ModeNilaiAkademikEnum = z.enum(['angka_kkm', 'angka_deskripsi', 'naratif_saja']);
export const VarianSikapEnum = z.enum(['profil_pelajar_pancasila', 'dimensi_profil_lulusan_madrasah', 'profil_rahmatan_lil_alamin']);
export const BasisDeskripsiEnum = z.enum(['capaian_pembelajaran', 'alur_tujuan_pembelajaran', 'poin_materi']);
export const StatusRaportEnum = z.enum([
  'draft',
  'dikirim_ke_wali_kelas',
  'dikonfirmasi',
  'difinalisasi',
  'siap_print'
]);

export const SectionSchema = z.object({
  sectionType: z.enum(['header', 'identitas', 'sikap', 'ekskul', 'catatan_wali_kelas', 'footer', 'nilai_mapel']),
  order: z.number().int().positive(),
  wajib: z.boolean().default(true),
  config: z.record(z.string(), z.any()).default({}),
});

export const TemplateRaportSchema = z.object({
  id: z.string().uuid(),
  sekolahId: z.string().uuid(),
  namaTemplate: z.string().min(1).max(255),
  jalurRegulasi: JalurRegulasiEnum,
  jenjang: JenjangEnum,
  kurikulum: KurikulumEnum,
  jenisLaporan: JenisLaporanEnum,
  modeNilaiAkademik: ModeNilaiAkademikEnum,
  varianSikap: VarianSikapEnum.nullable(),
  basisDeskripsi: BasisDeskripsiEnum,
  sections: z.array(SectionSchema),
  isDefault: z.boolean().default(false),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type TemplateRaport = z.infer<typeof TemplateRaportSchema>;

export const PresensiSnapshotSchema = z.object({
  sakit: z.number().int().min(0).default(0),
  izin: z.number().int().min(0).default(0),
  alpa: z.number().int().min(0).default(0),
});

export const NilaiMapelSchema = z.object({
  mapelId: z.string().uuid(),
  guruMapelMemberId: z.string().uuid(),
  nilaiAkhir: z.number().min(0).max(100).nullable(),
  kkm: z.number().min(0).max(100).nullable(),
  deskripsiCapaian: z.string().default(''),
  deskripsiSumberAI: z.boolean().default(false),
  deskripsiDibukaUntukReview: z.boolean().default(false),
  dikonfirmasiGuru: z.boolean().default(false),
});

export const DataRaportSchema = z.object({
  id: z.string().uuid(),
  siswaId: z.string().uuid(),
  nisn: z.string().length(10),
  nisLokal: z.string().min(1),
  kelasId: z.string().uuid(),
  templateRaportId: z.string().uuid(),
  periode: z.string().min(1),
  jenisLaporan: JenisLaporanEnum,
  status: StatusRaportEnum.default('draft'),
  nilaiMapel: z.array(NilaiMapelSchema),
  sikapId: z.string().uuid().optional(),
  catatanWaliKelas: z.string().optional(),
  presensiSnapshot: PresensiSnapshotSchema.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DataRaport = z.infer<typeof DataRaportSchema>;

export const DataRaportNilaiMapelSchema = z.object({
  id: z.string().uuid(),
  dataRaportId: z.string().uuid(),
  mapelId: z.string().uuid(),
  guruMapelMemberId: z.string().uuid(),
  nilaiAkhir: z.number().nullable(),
  kkm: z.number().nullable(),
  deskripsiCapaian: z.string(),
  deskripsiSumberAI: z.boolean(),
  deskripsiDibukaUntukReview: z.boolean(),
  dikonfirmasiGuru: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DataRaportNilaiMapel = z.infer<typeof DataRaportNilaiMapelSchema>;

export const StatusHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  dataRaportId: z.string().uuid(),
  status: StatusRaportEnum,
  changedAt: z.coerce.date(),
  changedBy: z.string(),
  changedByRole: z.enum(['guru_mapel', 'wali_kelas', 'kepala_sekolah', 'admin']).optional(),
});

export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntrySchema>;

export const CreateDataRaportInputSchema = z.object({
  siswaId: z.string().uuid(),
  nisn: z.string().length(10),
  nisLokal: z.string().min(1),
  kelasId: z.string().uuid(),
  templateRaportId: z.string().uuid(),
  periode: z.string().min(1),
  jenisLaporan: JenisLaporanEnum,
});

export type CreateDataRaportInput = z.infer<typeof CreateDataRaportInputSchema>;

export const UpdateNilaiMapelInputSchema = z.object({
  dataRaportId: z.string().uuid(),
  mapelId: z.string().uuid(),
  guruMapelMemberId: z.string().uuid(),
  nilaiAkhir: z.number().min(0).max(100).nullable().optional(),
  kkm: z.number().min(0).max(100).nullable().optional(),
  deskripsiCapaian: z.string().optional(),
  deskripsiSumberAI: z.boolean().optional(),
  deskripsiDibukaUntukReview: z.boolean().optional(),
  dikonfirmasiGuru: z.boolean().optional(),
});

export type UpdateNilaiMapelInput = z.infer<typeof UpdateNilaiMapelInputSchema>;

export const ChangeStatusInputSchema = z.object({
  dataRaportId: z.string().uuid(),
  newStatus: StatusRaportEnum,
  changedBy: z.string().uuid(),
  changedByRole: z.enum(['guru_mapel', 'wali_kelas', 'kepala_sekolah', 'admin']).optional(),
});

export type ChangeStatusInput = z.infer<typeof ChangeStatusInputSchema>;

// =============================================
// Layout Raport Schemas (File 06)
// =============================================

export const VarianTampilanEnum = z.enum(['ringkas', 'lengkap_dengan_deskripsi', 'dua_kolom', 'satu_kolom']);

export const LayoutSectionSchema = SectionSchema.extend({
  varianTampilan: VarianTampilanEnum,
  visible: z.boolean().default(true),
});

export const LayoutRaportSchema = z.object({
  id: z.string().uuid(),
  templateRaportId: z.string().uuid(),
  sekolahId: z.string().uuid(),
  namaLayout: z.string().min(1),
  sections: z.array(LayoutSectionSchema).min(1),
  createdByWaliKelasMemberId: z.string().uuid(),
  lastEditedAt: z.coerce.date().optional(),
});

export const CreateLayoutRaportInputSchema = z.object({
  templateRaportId: z.string().uuid(),
  sekolahId: z.string().uuid(),
  namaLayout: z.string().min(1),
  sections: z.array(LayoutSectionSchema).min(1),
  createdByWaliKelasMemberId: z.string().uuid(),
});

// =============================================
// Kontak Eksternal Raport Schemas (File 07)
// =============================================

export const StatusKlaimEnum = z.enum(['belum_klaim', 'sudah_klaim']);

export const KontakEksternalRaportSchema = z.object({
  id: z.string().uuid(),
  guruMapelMemberId: z.string().uuid(),
  namaKontak: z.string().min(1),
  kontakWA: z.string().optional(),
  kontakEmail: z.string().email().optional(),
  kelasId: z.string().uuid(),
  linkToken: z.string(),
  otpExpiredAt: z.coerce.date(),
  statusKlaim: StatusKlaimEnum.default('belum_klaim'),
  claimedByMemberId: z.string().uuid().optional(),
  createdAt: z.coerce.date().optional(),
});

export type KontakEksternalRaport = z.infer<typeof KontakEksternalRaportSchema>;

export const CreateKontakEksternalInputSchema = z.object({
  guruMapelMemberId: z.string().uuid(),
  namaKontak: z.string().min(1, 'Nama kontak wajib diisi'),
  kontakWA: z.string().optional(),
  kontakEmail: z.string().email('Format email tidak valid').optional(),
  kelasId: z.string().uuid(),
  otpExpiredAt: z.coerce.date(),
});

export type CreateKontakEksternalInput = z.infer<typeof CreateKontakEksternalInputSchema>;

export const KontakEksternalAksesLogSchema = z.object({
  id: z.string().uuid(),
  kontakEksternalId: z.string().uuid(),
  accessedAt: z.date(),
  ipAddress: z.string().optional(),
});

export type KontakEksternalAksesLog = z.infer<typeof KontakEksternalAksesLogSchema>;

export const UrutanSiswaEnum = z.enum(['abjad_nama', 'nomor_absen', 'nisn']);
export const UrutanKolomEnum = z.enum(['nilai_angka', 'deskripsi', 'predikat', 'kkm']);

export const PemetaanKolomProfileSchema = z.object({
  id: z.string().uuid(),
  sekolahId: z.string().uuid(),
  jalurRegulasi: JalurRegulasiEnum,
  urutanSiswa: UrutanSiswaEnum,
  urutanKolom: z.array(UrutanKolomEnum),
  systemVersionCatatan: z.string().optional(),
  lastValidatedAt: z.coerce.date(),
});

export type PemetaanKolomProfile = z.infer<typeof PemetaanKolomProfileSchema>;

export const CreatePemetaanKolomInputSchema = z.object({
  sekolahId: z.string().uuid(),
  jalurRegulasi: JalurRegulasiEnum,
  urutanSiswa: UrutanSiswaEnum,
  urutanKolom: z.array(UrutanKolomEnum).min(1, 'Pilih minimal 1 kolom'),
  systemVersionCatatan: z.string().optional(),
});

export type CreatePemetaanKolomInput = z.infer<typeof CreatePemetaanKolomInputSchema>;

export const UpdatePemetaanKolomInputSchema = z.object({
  urutanSiswa: UrutanSiswaEnum.optional(),
  urutanKolom: z.array(UrutanKolomEnum).min(1).optional(),
  systemVersionCatatan: z.string().optional(),
});

export type UpdatePemetaanKolomInput = z.infer<typeof UpdatePemetaanKolomInputSchema>;

export type LayoutSection = z.infer<typeof LayoutSectionSchema>;
export type VarianTampilan = z.infer<typeof VarianTampilanEnum>;
export type LayoutRaport = z.infer<typeof LayoutRaportSchema>;
export type CreateLayoutRaportInput = z.infer<typeof CreateLayoutRaportInputSchema>;
