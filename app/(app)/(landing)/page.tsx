import { cookies } from "next/headers";
import type { Metadata } from "next";

import LandingContent from "@/components/landing/LandingContent";

import {
  fallbackHero,
  fallbackFeatures,
  fallbackWhyPoints,
  fallbackFooter,
  resolveTablerIcon,
} from "@/lib/fallback-data";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  let ogImage: string | null = null;
  try {
    const res = await query("SELECT value FROM system_settings WHERE key = 'landing_hero'");
    if (res.rows.length > 0) {
      const val = typeof res.rows[0].value === "string" ? JSON.parse(res.rows[0].value) : res.rows[0].value;
      ogImage = val.ogImage || null;
    }
  } catch {}

  return {
    title: "GuruPRO AI - Guru bukan operator administrasi. Guru adalah pendidik.",
    description:
      "GuruPRO AI menyelesaikan administrasi dalam hitungan menit, agar guru kembali fokus mendidik, bukan disibukkan oleh dokumen.",
    openGraph: ogImage ? {
      images: [{ url: ogImage, width: 1200, height: 630 }],
    } : undefined,
  };
}

function parsePrice(val: any): number {
  if (typeof val === "string") return parseFloat(val) || 0;
  return Number(val) || 0;
}

function parseFeatures(val: any): string[] {
  if (!val) return [];
  if (typeof val === "string") try { return JSON.parse(val); } catch { return []; }
  if (Array.isArray(val)) return val;
  return [];
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const refCode = typeof sp.ref === "string" ? sp.ref.toUpperCase() : null;

  let isLoggedIn = false;
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (sessionCookie) {
      const session = JSON.parse(sessionCookie);
      if (session.user_id || session.id) isLoggedIn = true;
    }
  } catch {}

  // Default data
  let hero = fallbackHero;
  let features = fallbackFeatures;
  let whyPoints = fallbackWhyPoints;
  let footerDesc = fallbackFooter.description;
  let footerCopyright = fallbackFooter.copyright;
  let footerColumns: { title: string; links: { label: string; href: string }[] }[] = [];

  let faqData: any = null;
  let referralData: any = null;

  // Pricing plans - always load from DB
  let pricingPlans: any[] = [];

  // Try to get content from database cache
  try {
    const cacheRes = await query(
      "SELECT key, value FROM system_settings WHERE key IN ('landing_hero', 'landing_features', 'landing_why', 'landing_footer', 'faq_config', 'referral_config')"
    );

    if (cacheRes.rows.length > 0) {
      const cache: Record<string, any> = {};
      for (const row of cacheRes.rows) {
        try {
          cache[row.key] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        } catch {
          cache[row.key] = row.value;
        }
      }

      if (cache["landing_hero"]) {
        const h = cache["landing_hero"];
        hero = {
          badge: h.badge || fallbackHero.badge,
          headline: h.headline || fallbackHero.headline,
          subheadline: h.subheadline || fallbackHero.subheadline,
          stats: h.stats || fallbackHero.stats,
          ctaPrimary: { label: h.heroCTAPrimary?.label || "Mulai Gratis Sekarang", url: h.heroCTAPrimary?.url || "/register" },
          ctaSecondary: { label: h.heroCTASecondary?.label || "Lihat Demo", url: h.heroCTASecondary?.url || "#demo" },
          ogImage: h.ogImage || null,
        };
      }

      if (cache["landing_features"] && Array.isArray(cache["landing_features"])) {
        features = cache["landing_features"].map((f: any) => ({
          icon: resolveTablerIcon(f.icon) as any,
          title: f.title,
          description: f.description,
        }));
      }

      if (cache["landing_why"] && Array.isArray(cache["landing_why"])) {
        whyPoints = cache["landing_why"].map((p: any) => ({
          text: p.point || p.text || "",
        }));
      }

      if (cache["landing_footer"]) {
        const f = cache["landing_footer"];
        footerDesc = f.description || fallbackFooter.description;
        footerCopyright = f.copyrightText || fallbackFooter.copyright;
        if (f.links?.length) {
          const colMap: Record<string, { title: string; links: { label: string; href: string }[] }> = {};
          for (const link of f.links) {
            const col = link.column || "links";
            if (!colMap[col]) {
              colMap[col] = { title: col === "sekolah" ? "Untuk Sekolah" : "Links", links: [] };
            }
            colMap[col].links.push({ label: link.label, href: link.url });
          }
          footerColumns = Object.values(colMap);
        }
      }

      if (cache["faq_config"] && Array.isArray(cache["faq_config"])) {
        faqData = cache["faq_config"];
      }

      if (cache["referral_config"]) {
        referralData = cache["referral_config"];
      }
    }
  } catch {}

  // Load pricing plans from database
  try {
    const plansRes = await query(
      "SELECT * FROM pricing_plans WHERE is_active = true ORDER BY sort_order ASC"
    );
    if (plansRes.rows.length > 0) {
      pricingPlans = plansRes.rows.map((row: any) => ({
        id: row.id,
        package_name: row.package_name,
        price: parsePrice(row.price),
        tokens: typeof row.tokens === "string" ? parseInt(row.tokens) || 0 : row.tokens || 0,
        duration_days: row.duration_days,
        features: parseFeatures(row.features),
        popular: row.popular || false,
        sort_order: row.sort_order || 0,
      }));
    }
  } catch {}

  // Jika tidak ada plan dari DB, gunakan default
  const defaultPricingPlans = [
    { id: "free", package_name: "Gratis", price: 0, tokens: 10, duration_days: 30, popular: false, features: ["10 Token Kuota Sekali", "Masa Aktif 30 Hari", "Generator Soal (LOTS C1-C3)", "Dukungan Kurikulum Merdeka"] },
    { id: "three_month", package_name: "3 Bulan", price: 120000, tokens: 500, duration_days: 90, popular: true, features: ["500 Token Kuota Utama", "Masa Aktif 90 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Terpadu"] },
    { id: "six_month", package_name: "6 Bulan", price: 220000, tokens: 1100, duration_days: 180, popular: false, features: ["1100 Token Kuota Utama", "Masa Aktif 180 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "Server Prioritas & CS Prioritas"] },
    { id: "one_year", package_name: "1 Tahun", price: 400000, tokens: 2500, duration_days: 365, popular: false, features: ["2500 Token Kuota Utama", "Masa Aktif 365 Hari", "Generator Soal HOTS (C4-C6)", "Cetak Lembar Jawaban Resmi", "CS VIP 24/7 & Backup Riwayat"] },
  ];

  const defaultFaq = [
    {
      question: "Bagaimana cara kerja Token Kuota di GuruPRO?",
      answer: "Setiap paket langganan GuruPRO dilengkapi dengan Kuota Token bulanan. Token ini dipakai setiap kali Anda menggunakan fitur AI seperti Generator Soal, RPP, atau fitur cerdas lainnya. Kuota utama akan reset otomatis setiap siklus bulanan (dihitung dari tanggal mulai langganan). Sisa token utama tidak diakumulasi ke bulan berikutnya.",
    },
    {
      question: "Apa bedanya Kuota Utama dan Token Ekstra?",
      answer: "Kuota Utama adalah token yang diberikan setiap awal siklus langganan. Token Ekstra adalah token tambahan yang bisa Anda beli kapan saja saat kuota utama habis sebelum reset berikutnya. Token ekstra tidak hangus saat reset bulanan dan berlaku selama langganan aktif.",
    },
    {
      question: "Apakah Token Ekstra bisa hangus?",
      answer: "Token Ekstra akan tetap tersimpan selama masa langganan aktif. Jika langganan berakhir dan tidak diperpanjang dalam masa tenggang (grace period) 14 hari, maka token ekstra akan hangus. Pastikan memperpanjang langganan sebelum grace period berakhir.",
    },
    {
      question: "Berapa harga Token Ekstra?",
      answer: "Token Ekstra dijual dalam paket nominal tetap (50, 100, atau 250 token) dengan harga flat yang sama untuk semua tier. Pembelian token ekstra bisa dilakukan kapan saja langsung dari dashboard.",
    },
    {
      question: "Apakah metode pembayaran mendukung e-Wallet lokal?",
      answer: "Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia.",
    },
  ];

  const defaultReferral = {
    badge: "🎁 Program Kemitraan Guru",
    title: "Bagikan GuruProAI, Dapatkan Cashback & Token!",
    description: "Dapatkan cashback senilai Rp10.000 tunai atau tukarkan dengan +15 Token kuota untuk setiap guru yang mendaftar dan berlangganan menggunakan kode referral unik Anda! Teman Anda juga akan mendapatkan bonus +10 Token saat mendaftar.",
    benefits: [
      { icon: "💰", title: "Cashback Saldo Dompet", description: "Saldo cashback sebesar Rp10.000 ditambahkan ke dompet akun Anda setiap kali teman Anda meng-upgrade status akun menjadi PRO. Saldo ini dapat dicairkan langsung ke rekening bank." },
      { icon: "⚡", title: "Token Kuota Tambahan", description: "Dapatkan +15 Token kuota untuk generator pekerjaan Anda, sementara teman Anda mendapatkan +10 Token kuota tambahan saat mendaftar!" },
    ],
    ctaText: "Mulai Undang Teman",
    ctaLink: "",
  };

  return (
    <LandingContent
      isLoggedIn={isLoggedIn}
      refCode={refCode}
      hero={hero}
      features={features}
      whyPoints={whyPoints}
      footer={{
        description: footerDesc,
        copyright: footerCopyright,
        columns: footerColumns,
      }}
      pricingPlans={pricingPlans.length > 0 ? pricingPlans : defaultPricingPlans}
      faq={faqData || defaultFaq}
      referral={referralData || defaultReferral}
    />
  );
}