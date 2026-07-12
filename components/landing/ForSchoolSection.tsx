import {
  IconUserSearch,
  IconFileAnalytics,
  IconCalendarClock,
  IconCertificate,
  IconBrandWhatsapp,
  IconClipboardList,
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
  waNumber?: string;
  waMessage?: string;
}

export default function ForSchoolSection({
  title = "Untuk Kepala Sekolah & Yayasan",
  subtitle = "Pantau kinerja guru, kelola dokumen administrasi sekolah, dan tingkatkan akreditasi — semua tersentralisasi.",
  benefits = defaultBenefits as unknown as BenefitItem[],
  waNumber = "6281283960337",
  waMessage = "Halo saya ingin mendaftarkan sekolah saya di GuruPRO",
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
        <div className="text-center mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-success-500 hover:bg-success-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-success-900/30 hover:-translate-y-0.5 transition"
          >
            <IconBrandWhatsapp size={22} />
            Hubungi via WhatsApp
          </a>
          <a
            href="/daftar-sekolah"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-base rounded-2xl border border-white/20 hover:border-white/40 transition"
          >
            <IconClipboardList size={20} />
            Isi Form Pendaftaran
          </a>
        </div>
      </div>
    </section>
  );
}
