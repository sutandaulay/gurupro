import {
  IconFileTextAi,
  IconBook2,
  IconClipboardCheck,
  IconReportAnalytics,
  IconAward,
  IconMessages,
  IconUserSearch,
  IconFileAnalytics,
  IconCalendarClock,
  IconCertificate,
  IconSparkles,
  IconBrain,
} from "@tabler/icons-react";

import type { FeatureItem } from "@/components/landing/FeaturesSection";
import type { WhyPoint } from "@/components/landing/WhySection";
import type { HeroStat } from "@/components/landing/HeroSection";

const tablerIconMap: Record<string, React.ComponentType<any>> = {
  IconFileTextAi,
  IconBook2,
  IconClipboardCheck,
  IconReportAnalytics,
  IconAward,
  IconMessages,
  IconUserSearch,
  IconFileAnalytics,
  IconCalendarClock,
  IconCertificate,
  IconSparkles,
  IconBrain,
};

export function resolveTablerIcon(name: string): React.ComponentType<any> {
  return tablerIconMap[name] || IconSparkles;
}

export const fallbackHero = {
  badge: "✨ Didukung VideaClass",
  headline: "Administrasi Guru Lebih Cepat dengan AI",
  subheadline:
    "GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.",
  stats: [
    { value: "50.000+", label: "Guru Aktif" },
    { value: "6", label: "Modul Lengkap" },
    { value: "10x", label: "Lebih Cepat" },
  ] as HeroStat[],
  ctaPrimary: { label: "Mulai Gratis Sekarang", url: "/login?mode=register" },
  ctaSecondary: { label: "Lihat Demo", url: "#demo" },
  ogImage: null,
};

export const fallbackFeatures: FeatureItem[] = [
  {
    icon: IconFileTextAi,
    title: "Pembuat RPP AI",
    description:
      "Buat RPP sesuai Kurikulum Merdeka otomatis dalam hitungan menit. Cukup masukkan topik dan kelas, AI akan menyusun RPP lengkap dengan tujuan pembelajaran, kegiatan, dan asesmen.",
  },
  {
    icon: IconBook2,
    title: "Jurnal Mengajar",
    description:
      "Catat aktivitas harian kelas dengan mudah dan cepat. Jurnal tersinkronisasi otomatis dengan RPP dan kalender akademik sekolah.",
  },
  {
    icon: IconClipboardCheck,
    title: "Absensi Digital",
    description:
      "Kelola kehadiran siswa secara digital, lengkap dengan rekap otomatis dan ekspor ke Excel. Orang tua juga mendapat notifikasi kehadiran.",
  },
  {
    icon: IconReportAnalytics,
    title: "Buku Nilai & Rapor",
    description:
      "Input nilai, hitung otomatis berdasarkan bobot penilaian, dan cetak rapor siap pakai. Mendukung berbagai format rapor Kurikulum Merdeka dan K13.",
  },
  {
    icon: IconAward,
    title: "PKG & SKP",
    description:
      "Bantu proses Penilaian Kinerja Guru dan Sasaran Kinerja Pegawai dengan panduan AI. Lengkap dengan template dokumen yang sesuai regulasi.",
  },
  {
    icon: IconMessages,
    title: "Komunikasi Orang Tua",
    description:
      "Kirim notifikasi perkembangan siswa ke wali murid secara real-time. Fitur chat dan laporan periodik memudahkan kolaborasi sekolah dengan orang tua.",
  },
];

export const fallbackWhyPoints: WhyPoint[] = [
  { text: "Sesuai regulasi Kemenag & Kemendikbud terbaru" },
  { text: "Tersedia offline-first, cocok untuk daerah sinyal lemah" },
  { text: "Harga terjangkau, mulai Rp 49.000/bulan" },
  { text: "Data tersimpan aman, sesuai UU PDP No. 27/2022" },
];

export const fallbackFooter = {
  description:
    "Platform administrasi guru berbasis AI untuk membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor dalam satu platform.",
  socialLinks: [
    { label: "Facebook", href: "https://facebook.com/guruproai" },
    { label: "Instagram", href: "https://instagram.com/guruproai" },
    { label: "YouTube", href: "https://youtube.com/@guruproai" },
    { label: "TikTok", href: "https://tiktok.com/@guruproai" },
    { label: "LinkedIn", href: "https://linkedin.com/company/guruproai" },
  ],
  contactEmail: "support@gurupro.id",
  contactWhatsapp: "+62 812-8396-0337",
  copyright: "GuruPRO AI",
};
