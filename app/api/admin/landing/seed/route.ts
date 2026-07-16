import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const session = JSON.parse(sessionCookie);
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) throw new Error("Forbidden");
}

// Default Features
const defaultFeatures = [
  {
    icon: "IconFileTextAi",
    title: "Pembuat RPP AI",
    description: "Buat RPP sesuai Kurikulum Merdeka otomatis dalam hitungan menit. Cukup masukkan topik dan kelas, AI akan menyusun RPP lengkap dengan tujuan pembelajaran, kegiatan, dan asesmen.",
    order: 0,
    isActive: true,
  },
  {
    icon: "IconBook2",
    title: "Jurnal Mengajar",
    description: "Catat aktivitas harian kelas dengan mudah dan cepat. Jurnal tersinkronisasi otomatis dengan RPP dan kalender akademik sekolah.",
    order: 1,
    isActive: true,
  },
  {
    icon: "IconClipboardCheck",
    title: "Absensi Digital",
    description: "Kelola kehadiran siswa secara digital, lengkap dengan rekap otomatis dan ekspor ke Excel. Orang tua juga mendapat notifikasi kehadiran.",
    order: 2,
    isActive: true,
  },
  {
    icon: "IconReportAnalytics",
    title: "Buku Nilai & Rapor",
    description: "Input nilai, hitung otomatis berdasarkan bobot penilaian, dan cetak rapor siap pakai. Mendukung berbagai format rapor Kurikulum Merdeka dan K13.",
    order: 3,
    isActive: true,
  },
  {
    icon: "IconAward",
    title: "PKG & SKP",
    description: "Bantu proses Penilaian Kinerja Guru dan Sasaran Kinerja Pegawai dengan panduan AI. Lengkap dengan template dokumen yang sesuai regulasi.",
    order: 4,
    isActive: true,
  },
  {
    icon: "IconMessages",
    title: "Komunikasi Orang Tua",
    description: "Kirim notifikasi perkembangan siswa ke wali murid secara real-time. Fitur chat dan laporan periodik memudahkan kolaborasi sekolah dengan orang tua.",
    order: 5,
    isActive: true,
  },
];

// Default Why Points
const defaultWhyPoints = [
  { point: "Sesuai regulasi Kemenag & Kemendikbud terbaru", order: 0, isActive: true },
  { point: "Tersedia offline-first, cocok untuk daerah sinyal lemah", order: 1, isActive: true },
  { point: "Harga terjangkau, mulai Rp 49.000/bulan", order: 2, isActive: true },
  { point: "Data tersimpan aman, sesuai UU PDP No. 27/2022", order: 3, isActive: true },
];

// Default Landing Hero
const defaultHero = {
  badge: "✨ Didukung VideaClass AI",
  headline: "Administrasi Guru Lebih Cepat dengan AI",
  subheadline: "GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.",
  stats: [
    { number: "50.000+", label: "Guru Aktif" },
    { number: "6", label: "Modul Lengkap" },
    { number: "10x", label: "Lebih Cepat" },
  ],
};

// Default Footer
const defaultFooter = {
  description: "Platform administrasi guru berbasis AI untuk membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor dalam satu platform.",
  contactEmail: "support@gurupro.id",
  contactWhatsapp: "+62 812-8396-0337",
  copyrightText: "GuruPRO AI © 2026",
  links: [
    { label: "Beranda", url: "/", column: "links" },
    { label: "Fitur", url: "/#fitur", column: "links" },
    { label: "Harga", url: "/#harga", column: "links" },
    { label: "Blog", url: "/blog", column: "links" },
    { label: "Kebijakan Privasi", url: "/privacy", column: "links" },
    { label: "Syarat & Ketentuan", url: "/terms", column: "links" },
  ],
  socialLinks: [
    { platform: "facebook", url: "https://facebook.com/guruproai" },
    { platform: "instagram", url: "https://instagram.com/guruproai" },
    { platform: "youtube", url: "https://youtube.com/@guruproai" },
    { platform: "tiktok", url: "https://tiktok.com/@guruproai" },
  ],
};

// Default FAQ
const defaultFaq = [
  {
    question: "Bagaimana cara kerja perhitungan Token kuota?",
    answer: "Setiap kali Anda menekan tombol generate paket butir soal baru, sistem akan memotong 1 Token dari sisa batas limit token Anda. Token ini akan otomatis diperbarui setiap masa tagihan bulanan berjalan.",
  },
  {
    question: "Apakah metode pembayaran mendukung e-Wallet lokal?",
    answer: "Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia.",
  },
];

// Default Referral
const defaultReferral = {
  badge: "🎁 Program Kemitraan Guru",
  title: "Bagikan GuruPro, Dapatkan Cashback & Token!",
  description: "Dapatkan cashback senilai Rp10.000 tunai dan +20 Token kuota untuk setiap guru yang mendaftar dan berlangganan menggunakan kode referral unik Anda! Teman Anda juga akan mendapatkan bonus +10 Token saat mendaftar.",
  benefits: [
    { icon: "💰", title: "Cashback Saldo Dompet", description: "Saldo cashback sebesar Rp10.000 ditambahkan ke dompet akun Anda setiap kali teman Anda meng-upgrade status akun menjadi PRO. Saldo ini dapat dicairkan langsung ke rekening bank." },
    { icon: "⚡", title: "Token Kuota Tambahan", description: "Dapatkan +20 Token kuota ekstra gratis untuk generator soal Anda, sementara teman Anda mendapatkan +10 Token kuota tambahan saat mendaftar!" },
  ],
  ctaText: "Mulai Undang Teman",
  ctaLink: "",
};

export async function POST(request: Request) {
  try {
    // This endpoint can be called by anyone for initial setup
    // In production, add admin verification if needed
    // await verifyAdmin();

    const results: string[] = [];

    // Seed Features
    try {
      await query("DELETE FROM cms_features"); // Clear existing
      for (const feature of defaultFeatures) {
        await query(
          `INSERT INTO cms_features (icon, title, description, "order", "isActive") VALUES ($1, $2, $3, $4, $5)`,
          [feature.icon, feature.title, feature.description, feature.order, feature.isActive]
        );
      }
      results.push("✅ Features seeded (6 items)");
    } catch (e) {
      results.push(`⚠️ Features: ${(e as Error).message}`);
    }

    // Seed Why Points
    try {
      await query("DELETE FROM why_points"); // Clear existing
      for (const point of defaultWhyPoints) {
        await query(
          `INSERT INTO why_points (point, "order", "isActive") VALUES ($1, $2, $3)`,
          [point.point, point.order, point.isActive]
        );
      }
      results.push("✅ Why Points seeded (4 items)");
    } catch (e) {
      results.push(`⚠️ Why Points: ${(e as Error).message}`);
    }

    // Seed Hero to system_settings
    try {
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('landing_hero', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(defaultHero)]
      );
      results.push("✅ Hero seeded");
    } catch (e) {
      results.push(`⚠️ Hero: ${(e as Error).message}`);
    }

    // Seed Footer to system_settings
    try {
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('landing_footer', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(defaultFooter)]
      );
      results.push("✅ Footer seeded");
    } catch (e) {
      results.push(`⚠️ Footer: ${(e as Error).message}`);
    }

    // Seed FAQ to system_settings
    try {
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('faq_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(defaultFaq)]
      );
      results.push("✅ FAQ seeded");
    } catch (e) {
      results.push(`⚠️ FAQ: ${(e as Error).message}`);
    }

    // Seed Referral to system_settings
    try {
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('referral_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(defaultReferral)]
      );
      results.push("✅ Referral seeded");
    } catch (e) {
      results.push(`⚠️ Referral: ${(e as Error).message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Landing page content seeded successfully!",
      results,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to seed content" },
      { status: 500 }
    );
  }
}
