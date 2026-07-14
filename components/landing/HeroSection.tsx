import Image from "next/image";
import Link from "next/link";

export interface HeroStat {
  value: string; // CMS: stat value
  label: string; // CMS: stat label
}

export interface HeroSectionProps {
  badge?: string;
  headline?: string;
  subheadline?: string;
  stats?: HeroStat[];
  isLoggedIn?: boolean;
  refCode?: string | null;
  ctaPrimary?: { label: string; url: string };
  ctaSecondary?: { label: string; url: string };
  ogImage?: string | null;
}

export default function HeroSection({
  badge = "✨ Didukung VideaClass",
  headline = "Administrasi Guru Lebih Cepat dengan AI",
  subheadline = "GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.",
  stats = [
    { value: "50.000+", label: "Guru Aktif" },
    { value: "6", label: "Modul Lengkap" },
    { value: "10x", label: "Lebih Cepat" },
  ],
  isLoggedIn = false,
  refCode = null,
  ctaPrimary = { label: "Mulai Gratis Sekarang", url: "/register" },
  ctaSecondary = { label: "Lihat Demo", url: "#demo" },
  ogImage,
}: HeroSectionProps) {
  const registerHref = refCode
    ? `/register?ref=${refCode}`
    : "/register";

  return (
    <section className="relative pt-36 pb-20 md:pt-48 md:pb-28 overflow-hidden">
      {/* Background: subtle violet-to-purple gradient with dot pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/80 via-white to-primary-100/50 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #7c3aed 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Decorative blurred orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container-page relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column: Text Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full mb-6 border border-primary-100">
              {badge}
            </span>

            {/* Headline */}
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900 leading-[1.15] md:leading-tight text-balance">
              {headline}
            </h1>

            {/* Sub-headline */}
            <p className="mt-6 text-neutral-500 text-base md:text-lg max-w-xl leading-relaxed">
              {subheadline}
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href={
                  isLoggedIn
                    ? "/dashboard"
                    : refCode
                      ? registerHref
                      : ctaPrimary?.url || "/register"
                }
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary-100 hover:shadow-primary-200 hover:-translate-y-0.5 transition text-center"
              >
                {ctaPrimary.label}
              </Link>
              <a
                href={ctaSecondary.url}
                className="px-8 py-4 bg-white border-2 border-neutral-200 text-neutral-700 font-bold text-base rounded-2xl hover:border-primary-200 hover:text-primary-600 transition text-center shadow-sm"
              >
                {ctaSecondary.label}
              </a>
            </div>

            {/* Stats Bar */}
            <div className="mt-16 grid grid-cols-3 gap-6 md:gap-10 max-w-lg mx-auto lg:mx-0">
              {stats.map((stat, idx) => (
                <div key={idx}>
                  <p className="text-2xl md:text-3xl font-black text-primary-600">
                    {stat.value}
                  </p>
                  <p className="text-xs text-neutral-500 font-semibold mt-1 uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: OG Image or Dashboard Mockup */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative w-full max-w-lg">
              {ogImage ? (
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-neutral-200/60">
                  <Image src={ogImage} alt={headline} width={0} height={0} sizes="100vw" className="w-full h-auto object-cover" />
                  <div className="absolute -top-6 -right-6 w-28 h-28 bg-gradient-to-br from-primary-500 to-purple-600 rounded-3xl shadow-lg shadow-primary-200 -z-10" />
                  <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-gradient-to-br from-purple-400 to-primary-500 rounded-2xl shadow-lg shadow-purple-200 -z-10" />
                </div>
              ) : (
                <>
                  <div className="relative bg-white rounded-3xl shadow-2xl border border-neutral-200/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-100">
                      <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-error-400" />
                        <span className="w-3 h-3 rounded-full bg-warning-400" />
                        <span className="w-3 h-3 rounded-full bg-success-400" />
                      </div>
                      <div className="ml-4 flex-1 h-6 bg-neutral-100 rounded-lg" />
                      <div className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center">
                        <span className="w-3 h-3 bg-primary-600 rounded" />
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
                          <div className="h-2 w-12 bg-primary-200 rounded-full mb-2" />
                          <div className="h-4 w-16 bg-primary-600 rounded-full" />
                        </div>
                        <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                          <div className="h-2 w-12 bg-purple-200 rounded-full mb-2" />
                          <div className="h-4 w-16 bg-purple-600 rounded-full" />
                        </div>
                        <div className="p-3 bg-info-50 rounded-xl border border-info-100">
                          <div className="h-2 w-12 bg-info-200 rounded-full mb-2" />
                          <div className="h-4 w-16 bg-info-600 rounded-full" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="h-4 w-8 bg-neutral-200 rounded" />
                          <div className="h-4 flex-1 bg-neutral-100 rounded" />
                          <div className="h-4 w-20 bg-neutral-100 rounded" />
                          <div className="h-4 w-16 bg-neutral-100 rounded" />
                        </div>
                        {[0, 1, 2, 3].map((row) => (
                          <div key={row} className="flex gap-2 items-center py-2 border-t border-neutral-50">
                            <div className="h-3 w-8 bg-neutral-200 rounded" />
                            <div className="h-3 flex-1 bg-neutral-100 rounded" />
                            <div className="h-3 w-20 bg-neutral-100 rounded" />
                            <div className="h-3 w-16 bg-primary-100 rounded" />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                        <div className="h-3 w-24 bg-neutral-200 rounded-full" />
                        <div className="h-8 w-24 bg-primary-600 rounded-xl" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-6 -right-6 w-28 h-28 bg-gradient-to-br from-primary-500 to-purple-600 rounded-3xl shadow-lg shadow-primary-200 -z-10" />
                  <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-gradient-to-br from-purple-400 to-primary-500 rounded-2xl shadow-lg shadow-purple-200 -z-10" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
