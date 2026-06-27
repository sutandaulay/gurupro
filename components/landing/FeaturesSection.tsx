import {
  IconFileTextAi,
  IconBook2,
  IconClipboardCheck,
  IconReportAnalytics,
  IconAward,
  IconMessages,
} from "@tabler/icons-react";

const defaultFeatures = [
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
] as const;

export interface FeatureItem {
  icon: typeof defaultFeatures[number]["icon"];
  title: string;
  description: string;
}

export interface FeaturesSectionProps {
  title?: string;
  subtitle?: string;
  features?: FeatureItem[];
}

export default function FeaturesSection({
  title = "Semua Kebutuhan Administrasi Guru, Dalam Satu Platform",
  subtitle,
  features = defaultFeatures as unknown as FeatureItem[],
}: FeaturesSectionProps) {
  return (
    <section id="fitur" className="py-20 md:py-28 bg-white">
      <div className="container-page">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-neutral-500 text-base leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="group p-6 md:p-8 bg-neutral-50 border border-neutral-100 rounded-3xl hover:bg-white hover:border-primary-100 hover:shadow-xl hover:shadow-primary-100/30 transition duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition duration-300">
                  <Icon size={24} />
                </div>
                <h3 className="font-bold text-lg text-neutral-900 mt-5">
                  {feature.title}
                </h3>
                <p className="text-neutral-500 text-sm mt-2 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
