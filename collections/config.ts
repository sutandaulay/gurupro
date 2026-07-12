export const COLLECTIONS = {
  LEADER_CONTACTS: "leader-contacts",
  PERFORMANCE_SHARE_LINKS: "performance-share-links",
  DOCUMENT_ACCESS_GRANTS: "document-access-grants",
  OTP_VERIFICATIONS: "otp-verifications",
} as const;

export const ALLOWED_DOCUMENT_CATEGORIES = [
  {
    value: "rpp_modul_ajar",
    label: "RPP / Modul Ajar",
    description: "Rencana Pelaksanaan Pembelajaran dan Modul Ajar",
  },
  {
    value: "jurnal_harian",
    label: "Jurnal Harian",
    description: "Jurnal Mengajar Harian",
  },
  {
    value: "bank_soal",
    label: "Bank Soal / Evaluasi",
    description: "Kumpulan soal dan instrumen evaluasi",
  },
  {
    value: "lkpd_bahan_ajar",
    label: "LKPD / Bahan Ajar",
    description: "Lembar Kerja Peserta Didik dan Bahan Ajar",
  },
] as const;

export const DOCUMENT_CATEGORY_BLOCKED_KEYWORDS = [
  "keuangan",
  "finansial",
  "financial",
  "uang",
  "gaji",
  "bonus",
  "insentif",
  "payroll",
  "salary",
  "transaction",
  "pembayaran",
] as const;

export const OTP_VALIDITY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_RATE_LIMIT_PER_HOUR = 3;
export const SHARE_LINK_DEFAULT_EXPIRY_DAYS = 30;

export const ACCESS_LEVELS = {
  LEVEL1_SUMMARY_ONLY: "level1_summary_only",
  LEVEL2_DOCUMENT_ACCESS: "level2_document_access",
} as const;

export const LEADER_ROLES = {
  KEPALA_SEKOLAH: "kepala_sekolah",
  PENGAWAS: "pengawas",
  WALI_KELAS: "wali_kelas",
  LAINNYA: "lainnya",
} as const;

export const OTP_CHANNELS = {
  WHATSAPP: "whatsapp",
  EMAIL: "email",
} as const;
