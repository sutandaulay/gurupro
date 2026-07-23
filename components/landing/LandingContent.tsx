import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import WhySection from "@/components/landing/WhySection";
import ForSchoolSection from "@/components/landing/ForSchoolSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import type { HeroStat } from "@/components/landing/HeroSection";
import type { FeatureItem } from "@/components/landing/FeaturesSection";
import type { WhyPoint } from "@/components/landing/WhySection";
import type { FaqItem, ReferralConfig } from "@/lib/settings";

export interface PricingPlanDisplay {
  id: string;
  package_name: string;
  price: number;
  tokens: number;
  duration_days: number;
  features: string[];
  popular: boolean;
  sort_order?: number;
}

export interface LandingContentProps {
  isLoggedIn: boolean;
  refCode: string | null;
  hero: {
    badge: string;
    headline: string;
    subheadline: string;
    stats: HeroStat[];
    ctaPrimary?: { label: string; url: string };
    ctaSecondary?: { label: string; url: string };
    ogImage?: string | null;
  };
  features: FeatureItem[];
  whyPoints: WhyPoint[];
  footer: {
    description: string;
    copyright: string;
    columns?: { title: string; links: { label: string; href: string }[] }[];
  };
  showPreviewBanner?: boolean;
  pricingPlans?: PricingPlanDisplay[];
  faq?: FaqItem[];
  referral?: ReferralConfig;
}

const formatPrice = (p: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "decimal",
    minimumFractionDigits: 0,
  }).format(p);

function gridColsClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function getPlanEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("gratis") || lower.includes("free")) return "🌱";
  if (lower.includes("1 tahun") || lower.includes("tahunan") || lower.includes("year")) return "👑";
  if (lower.includes("6 bulan") || lower.includes("semester")) return "⭐";
  return "⚡";
}

function getPlanDesc(name: string, price: number, idx: number): string {
  const lower = name.toLowerCase();
  if (price === 0) return "Uji coba awal fitur GuruPRO";
  if (lower.includes("1 tahun") || lower.includes("tahunan")) return "Efisiensi maksimal jangka panjang";
  if (lower.includes("6 bulan") || lower.includes("semester")) return "Persiapan matang untuk 2 semester";
  if (lower.includes("3 bulan") || lower.includes("triwulan")) return "Pendamping mengajar 1 triwulan";
  return `Paket ${name} - Akses penuh fitur GuruPRO`;
}

function getCardStyle(plan: PricingPlanDisplay, idx: number, total: number) {
  if (plan.popular) {
    return {
      bgClass: "bg-white border-2 border-primary-600 shadow-lg shadow-primary-100",
      ctaClass: "bg-primary-600 hover:bg-primary-700 text-white",
      badge: "Paling Populer 🔥",
      transform: true,
    };
  }
  if (idx === 0 && plan.price === 0) {
    return {
      bgClass: "bg-white border-slate-200/80 hover:border-slate-300",
      ctaClass: "border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700",
      badge: null,
      transform: false,
    };
  }
  if (idx === total - 1) {
    return {
      bgClass: "bg-white border-amber-300 hover:border-amber-400",
      ctaClass: "bg-amber-500 hover:bg-amber-600 text-white",
      badge: "Nilai Terbaik 🏆",
      transform: false,
    };
  }
  return {
    bgClass: "bg-white border-slate-200/80 hover:border-slate-300",
    ctaClass: "bg-primary-50 hover:bg-primary-100 text-primary-600",
    badge: null,
    transform: false,
  };
}

export default function LandingContent({
  isLoggedIn,
  refCode,
  hero,
  features,
  whyPoints,
  footer,
  showPreviewBanner,
  pricingPlans: pricingPlansProp,
  faq: faqProp,
  referral: referralProp,
}: LandingContentProps) {
  const pricingPlans = pricingPlansProp || [
    { id: "free", package_name: "Gratis", price: 0, tokens: 10, duration_days: 30, popular: false, features: ["10 Poin Kuota Sekali", "Masa Aktif 30 Hari", "Generator Soal (LOTS C1-C3)", "Dukungan Kurikulum Merdeka"] },
    { id: "three_month", package_name: "3 Bulan", price: 120000, tokens: 500, duration_days: 90, popular: true, features: ["500 Poin Kuota Utama", "Masa Aktif 90 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Terpadu"] },
    { id: "six_month", package_name: "6 Bulan", price: 220000, tokens: 1100, duration_days: 180, popular: false, features: ["1100 Poin Kuota Utama", "Masa Aktif 180 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Prioritas"] },
    { id: "one_year", package_name: "1 Tahun", price: 400000, tokens: 2500, duration_days: 365, popular: false, features: ["2500 Poin Kuota Utama", "Masa Aktif 365 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "CS VIP 24/7 & Backup Riwayat"] },
  ];
  const visiblePlans = pricingPlans.filter(plan => !(isLoggedIn && plan.price === 0));
  const faq = faqProp || [
    {
      question: "Bagaimana cara kerja perhitungan Poin kuota?",
      answer: "Setiap kali Anda menekan tombol generate paket butir soal baru, sistem akan memotong 1 Poin dari sisa batas limit poin Anda. Poin ini akan otomatis diperbarui setiap masa tagihan bulanan berjalan.",
    },
    {
      question: "Apakah metode pembayaran mendukung e-Wallet lokal?",
      answer: "Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia.",
    },
  ];
  const referral = referralProp || {
    badge: "🎁 Program Kemitraan Guru",
    title: "Bagikan GuruPro, Dapatkan Cashback & Poin!",
    description: "Dapatkan cashback senilai Rp10.000 tunai dan +20 Poin kuota untuk setiap guru yang mendaftar dan berlangganan menggunakan kode referral unik Anda! Teman Anda juga akan mendapatkan bonus +10 Poin saat mendaftar.",
    benefits: [
      { icon: "💰", title: "Cashback Saldo Dompet", description: "Saldo cashback sebesar Rp10.000 ditambahkan ke dompet akun Anda setiap kali teman Anda meng-upgrade status akun menjadi PRO. Saldo ini dapat dicairkan langsung ke rekening bank." },
      { icon: "⚡", title: "Poin Kuota Tambahan", description: "Dapatkan +20 Poin kuota ekstra gratis untuk generator soal Anda, sementara teman Anda mendapatkan +10 Poin kuota tambahan saat mendaftar!" },
    ],
    ctaText: "Mulai Undang Teman",
    ctaLink: "",
  };
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-primary-500 selection:text-white">
      {showPreviewBanner && (
        <div className="bg-amber-500 text-white text-xs font-bold py-2.5 px-4 text-center sticky top-0 z-50 flex items-center justify-center gap-2 shadow-md">
          <span>🔍 PREVIEW MODE — Konten ini adalah pratayau dan mungkin belum dipublikasikan.</span>
        </div>
      )}

      {refCode && !showPreviewBanner && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-bold py-2.5 px-4 text-center sticky top-0 z-50 flex items-center justify-center gap-2 shadow-md animate-fadeIn no-print">
          <span className="text-base">🎁</span>
          <span>
            Anda diundang oleh teman! Daftar sekarang menggunakan kode referral{" "}
            <strong>{refCode}</strong> untuk mendapatkan bonus{" "}
            <strong>+10 Poin kuota gratis</strong>!
          </span>
        </div>
      )}

      <Navbar
        navItems={[
          { label: "Beranda", href: "/" },
          { label: "Fitur", href: "#fitur" },
          { label: "Cara Kerja", href: "#cara-kerja" },
          { label: "Harga", href: "#harga" },
          { label: "Blog", href: "/blog" },
        ]}
        isLoggedIn={isLoggedIn}
        refCode={refCode}
      />

      <HeroSection
        badge={hero.badge}
        headline={hero.headline}
        subheadline={hero.subheadline}
        stats={hero.stats}
        isLoggedIn={isLoggedIn}
        refCode={refCode}
        ctaPrimary={hero.ctaPrimary}
        ctaSecondary={hero.ctaSecondary}
        ogImage={hero.ogImage}
      />

      <FeaturesSection title="⏱️ Rata-rata guru habiskan 12+ jam/minggu untuk kerjaan administratif" features={features} 
      subtitle="Semua Kebutuhan Administrasi Guru,
Selesai Dalam Hitungan Menit — Bukan Jam"
      />

      <WhySection
        title="Emang Worth It Pakai GuruPRO AI?"
        subtitle="Bukan sekadar aplikasi, GuruPRO AI adalah Asisten Guru yang benar-benar mengerti kebutuhan Administrasi Guru"
        points={whyPoints}
      />

      <section id="harga" className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-50/50 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-primary-600 bg-primary-50 border border-primary-100 px-3 py-1.5 rounded-full mb-4">
              🏷️ Rencana Langganan Fleksibel
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              Investasi Terbaik untuk Efisiensi Anda
            </h2>
            <p className="mt-4 text-slate-500 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Pilih paket yang paling pas untuk kebutuhan mengajar Anda. Seluruh paket didesain khusus untuk mendukung tugas administrasi guru Indonesia.
            </p>
          </div>

          <div className={`grid gap-6 max-w-7xl mx-auto items-stretch ${gridColsClass(visiblePlans.length)}`}>
            {visiblePlans.map((plan, idx) => {
              const perMonth = plan.price > 0 && plan.duration_days > 0
                ? Math.round(plan.price / Math.max(1, Math.round(plan.duration_days / 30)))
                : 0;
              const style = getCardStyle(plan, idx, visiblePlans.length);
              const emoji = getPlanEmoji(plan.package_name);
              const desc = getPlanDesc(plan.package_name, plan.price, idx);
              const checkoutId = plan.id;
              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-xl transition duration-300 relative group ${style.bgClass} ${style.transform ? "transform md:-translate-y-2" : ""}`}
                >
                  {style.badge && (
                    <span className={`absolute top-0 right-6 -translate-y-1/2 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md ${plan.popular ? "bg-gradient-to-r from-primary-600 to-purple-600 animate-bounce" : "bg-amber-500"}`}>
                      {style.badge}
                    </span>
                  )}
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-slate-900 font-black text-xl tracking-tight">{plan.package_name}</h4>
                        <p className="text-slate-400 text-[11px] mt-0.5">{desc}</p>
                      </div>
                      <span className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-base shadow-inner">{emoji}</span>
                    </div>
                    <div className="mt-5 flex items-baseline text-slate-900">
                      {plan.price > 0 && <span className="text-2xl font-black">Rp</span>}
                      <span className="text-4xl font-extrabold tracking-tight">{formatPrice(plan.price)}</span>
                      <span className="text-slate-400 text-xs font-semibold ml-1">{plan.price === 0 ? `/ ${plan.duration_days} hari` : "/ paket"}</span>
                    </div>
                    {perMonth > 0 ? (
                      <p className="text-[10px] text-primary-600 font-semibold mt-1">Setara Rp {formatPrice(perMonth)}/bulan</p>
                    ) : (
                      plan.price === 0 ? <p className="text-[10px] text-slate-400 font-semibold mt-1">Tanpa biaya, coba langsung gratis</p> : null
                    )}
                    <div className="w-full h-px bg-slate-100 my-5" />
                    <ul className="space-y-3 text-xs font-medium text-slate-600">
                      {plan.features.map((f, fi) => (
                        <li key={fi} className="flex items-center gap-2">
                          <span className="text-emerald-500">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    href={isLoggedIn ? `/dashboard?checkout=${checkoutId}` : refCode ? `/login?checkout=${checkoutId}&ref=${refCode}` : `/login?checkout=${checkoutId}`}
                    className={`w-full py-3 text-center font-bold text-xs rounded-2xl mt-6 transition duration-200 block ${style.ctaClass}`}
                  >
                    {plan.price === 0 ? "Coba Gratis" : "Beli Sekarang"}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <ForSchoolSection />

      <section id="referral" className="py-20 bg-gradient-to-br from-primary-900 to-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <span className="bg-primary-500/20 text-primary-300 border border-primary-500/30 text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full inline-block mb-6">
            {referral.badge}
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            {referral.title}
          </h2>
          <p className="mt-6 text-slate-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {referral.description}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 max-w-lg mx-auto text-left">
            {referral.benefits.map((b, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <span className="text-xl">{b.icon}</span>
                <h4 className="font-bold text-xs mt-2 uppercase tracking-wider text-primary-300">{b.title}</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">{b.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              href={
                isLoggedIn
                  ? "/dashboard"
                  : refCode
                    ? `/register?ref=${refCode}`
                    : referral.ctaLink || "/register"
              }
              className="inline-block px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-base rounded-2xl shadow-lg transition duration-200"
            >
              {referral.ctaText}
            </Link>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Pertanyaan yang Sering Diajukan</h2>
            <p className="mt-2 text-slate-500 text-sm">Masih ragu mengenai GuruPRO? Berikut rincian jawabannya.</p>
          </div>
          <div className="space-y-6">
            {faq.map((item, idx) => (
              <div key={idx} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                <h4 className="font-bold text-sm text-slate-900">{item.question}</h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        headline="Mulai Perjalanan Tanpa Administrasi yang Membebankan"
        subheadline="Bergabunglah bersama ribuan guru Indonesia yang sudah merasakan manfaat GuruPRO AI"
        primaryCTA={hero.ctaPrimary?.label || "Coba Gratis 14 Hari"}
        primaryHref={hero.ctaPrimary?.url || "/register"}
        secondaryCTA={hero.ctaSecondary?.label || "Hubungi Kami"}
        secondaryHref={hero.ctaSecondary?.url || "/kontak"}
        badge="Tidak perlu kartu kredit"
        refCode={refCode}
        isLoggedIn={isLoggedIn}
      />

      <Footer
        description={footer.description}
        copyright={footer.copyright}
        columns={footer.columns?.length ? (footer.columns as any) : undefined}
      />
    </div>
  );
}