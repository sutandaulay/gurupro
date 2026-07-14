export interface CTASectionProps {
  headline?: string;
  subheadline?: string;
  primaryCTA?: string;
  primaryHref?: string;
  secondaryCTA?: string;
  secondaryHref?: string;
  badge?: string;
  refCode?: string | null;
  isLoggedIn?: boolean;
}

export default function CTASection({
  headline = "Mulai Perjalanan Tanpa Administrasi yang Membebankan",
  subheadline = "Bergabunglah bersama ribuan guru Indonesia yang sudah merasakan manfaat GuruPRO AI",
  primaryCTA = "Coba Gratis 14 Hari",
  primaryHref = "/register",
  secondaryCTA = "Hubungi Kami",
  secondaryHref = "/kontak",
  badge = "Tidak perlu kartu kredit",
  refCode = null,
  isLoggedIn = false,
}: CTASectionProps) {
  // Generate register href with refCode
  const registerHref = refCode
    ? `/register?ref=${refCode}`
    : "/register";

  // Determine final primary href
  const finalPrimaryHref = isLoggedIn
    ? "/dashboard"
    : primaryHref === "/register"
      ? registerHref
      : primaryHref;
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 text-white relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container-page relative z-10 text-center">
        {/* Badge */}
        {badge && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary-200 bg-white/10 px-3 py-1.5 rounded-full mb-6 border border-white/20">
            {badge}
          </span>
        )}

        {/* Headline */}
        <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight max-w-4xl mx-auto text-balance">
          {headline}
        </h2>

        {/* Subheadline */}
        <p className="mt-6 text-primary-100 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          {subheadline}
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={finalPrimaryHref}
            className="px-8 py-4 bg-white text-primary-700 font-bold text-base rounded-2xl shadow-lg shadow-primary-900/30 hover:bg-primary-50 hover:-translate-y-0.5 transition text-center"
          >
            {primaryCTA}
          </a>
          <a
            href={secondaryHref}
            className="px-8 py-4 bg-white/10 border-2 border-white/30 text-white font-bold text-base rounded-2xl hover:bg-white/20 transition text-center"
          >
            {secondaryCTA}
          </a>
        </div>
      </div>
    </section>
  );
}
