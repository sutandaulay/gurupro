import {
  IconUserSearch,
  IconFileAnalytics,
  IconCalendarClock,
  IconCertificate,
} from "@tabler/icons-react";

const defaultBenefits = [
  {
    icon: IconUserSearch,
    title: "Monitoring Guru Real-time",
    description:
      "Pantau aktivitas mengajar dan kinerja guru secara langsung melalui dashboard terpusat.",
  },
  {
    icon: IconFileAnalytics,
    title: "Laporan Administrasi Otomatis",
    description:
      "Semua laporan administrasi sekolah tergenerate otomatis, siap diserahkan ke dinas atau yayasan.",
  },
  {
    icon: IconCalendarClock,
    title: "Manajemen Kelas & Jadwal",
    description:
      "Atur jadwal pelajaran, pembagian kelas, dan penugasan guru dengan sistem drag-and-drop.",
  },
  {
    icon: IconCertificate,
    title: "Siap Akreditasi BAN-S/M",
    description:
      "Dokumen administrasi sekolah tersusun rapi dan siap pakai untuk keperluan akreditasi.",
  },
] as const;

export interface BenefitItem {
  icon: typeof defaultBenefits[number]["icon"];
  title: string;
  description: string;
}

export interface ForSchoolSectionProps {
  title?: string;
  subtitle?: string;
  benefits?: BenefitItem[];
  ctaText?: string;
  ctaHref?: string;
}

export default function ForSchoolSection({
  title = "Untuk Kepala Sekolah & Yayasan",
  subtitle = "Pantau kinerja guru, kelola dokumen administrasi sekolah, dan tingkatkan akreditasi — semua tersentralisasi.",
  benefits = defaultBenefits as unknown as BenefitItem[],
  ctaText = "Daftarkan Sekolah Saya",
  ctaHref = "/login?mode=register&sekolah=1",
}: ForSchoolSectionProps) {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-primary-900 via-primary-800 to-purple-900 text-white relative overflow-hidden">
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="container-page relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            {title}
          </h2>
          <p className="mt-4 text-primary-200 text-base leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon;
            return (
              <div
                key={idx}
                className="p-6 bg-white/5 border border-primary-400/20 rounded-3xl backdrop-blur-sm hover:bg-white/10 hover:border-primary-300/40 transition duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary-500/20 border border-primary-400/30 flex items-center justify-center text-primary-200">
                  <Icon size={24} />
                </div>
                <h3 className="font-bold text-base mt-5">
                  {benefit.title}
                </h3>
                <p className="text-sm text-primary-200 mt-2 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href={ctaHref}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-700 font-bold text-base rounded-2xl shadow-lg shadow-primary-900/30 hover:bg-primary-50 hover:-translate-y-0.5 transition"
          >
            {ctaText}
          </a>
        </div>
      </div>
    </section>
  );
}
