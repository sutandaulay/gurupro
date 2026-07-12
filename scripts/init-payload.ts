/**
 * Payload CMS Migration Script
 *
 * Usage: npx tsx scripts/init-payload.ts
 *
 * This script:
 * 1. Pushes Payload schema to database
 * 2. Creates default CMS content
 */

import { getPayload as getPayloadClient } from "payload";
import config from "../payload.config";

async function initPayload() {
  console.log("🚀 Starting Payload CMS Initialization...\n");

  try {
    // Initialize Payload with config
    console.log("📦 Connecting to Payload CMS...");
    const payload = await getPayloadClient({ config });
    console.log("✅ Payload connected successfully!\n");

    // Check if collections exist by trying to query them
    console.log("🔍 Checking existing data...\n");

    // Initialize Features collection with default data
    console.log("📝 Creating default Features...");
    try {
      const existingFeatures = await payload.find({
        collection: "cms-features",
        limit: 1,
      });

      if (existingFeatures.docs.length === 0) {
        // Create default features
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

        for (const feature of defaultFeatures) {
          await payload.create({
            collection: "cms-features",
            data: feature,
          });
        }
        console.log("✅ Default features created!\n");
      } else {
        console.log("ℹ️ Features already exist, skipping...\n");
      }
    } catch (err) {
      console.log("⚠️ Could not create features:", (err as Error).message);
    }

    // Initialize Why Points collection
    console.log("📝 Creating default Why Points...");
    try {
      const existingWhy = await payload.find({
        collection: "why-points",
        limit: 1,
      });

      if (existingWhy.docs.length === 0) {
        const defaultWhyPoints = [
          { point: "Sesuai regulasi Kemenag & Kemendikbud terbaru", order: 0, isActive: true },
          { point: "Tersedia offline-first, cocok untuk daerah sinyal lemah", order: 1, isActive: true },
          { point: "Harga terjangkau, mulai Rp 49.000/bulan", order: 2, isActive: true },
          { point: "Data tersimpan aman, sesuai UU PDP No. 27/2022", order: 3, isActive: true },
        ];

        for (const point of defaultWhyPoints) {
          await payload.create({
            collection: "why-points",
            data: point,
          });
        }
        console.log("✅ Default Why Points created!\n");
      } else {
        console.log("ℹ️ Why Points already exist, skipping...\n");
      }
    } catch (err) {
      console.log("⚠️ Could not create why points:", (err as Error).message);
    }

    // Initialize Landing Page global
    console.log("📝 Creating/Updating Landing Page global...");
    try {
      await payload.updateGlobal({
        slug: "landing-page",
        data: {
          heroBadgeText: "✨ Didukung VideaClass AI",
          heroHeadline: "Administrasi Guru Lebih Cepat dengan AI",
          heroSubheadline: "GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.",
          heroStats: [
            { number: "50.000+", label: "Guru Aktif" },
            { number: "6", label: "Modul Lengkap" },
            { number: "10x", label: "Lebih Cepat" },
          ],
        },
      });
      console.log("✅ Landing Page global created/updated!\n");
    } catch (err) {
      console.log("⚠️ Could not create landing page:", (err as Error).message);
    }

    // Initialize Footer Content global
    console.log("📝 Creating/Updating Footer global...");
    try {
      await payload.updateGlobal({
        slug: "footer-content",
        data: {
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
        },
      });
      console.log("✅ Footer global created/updated!\n");
    } catch (err) {
      console.log("⚠️ Could not create footer:", (err as Error).message);
    }

    // Initialize Chatbot Config global
    console.log("📝 Creating/Updating Chatbot Config global...");
    try {
      await payload.updateGlobal({
        slug: "chatbot-config",
        data: {
          isEnabled: false, // Disabled by default
          welcomeMessage: "Halo! 👋 Saya asisten AI GuruPRO. Ada yang bisa saya bantu? Silakan tanyakan tentang cara menggunakan platform, fitur-fitur yang tersedia, atau masalah yang Anda hadapi.",
          systemPrompt: "Kamu adalah Customer Service Assistant untuk platform GuruPRO AI. GuruPRO adalah platform administrasi guru berbasis AI yang membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor. Selalu jawab dengan ramah dalam Bahasa Indonesia. Jika pertanyaan di luar topik, arahkan ke topik yang relevan.",
          humanCSUrl: "https://wa.me/6281283960337",
        },
      });
      console.log("✅ Chatbot Config global created/updated!\n");
    } catch (err) {
      console.log("⚠️ Could not create chatbot config:", (err as Error).message);
    }

    console.log("🎉 Payload CMS Initialization Complete!");
    console.log("\n📌 Next Steps:");
    console.log("1. Run: npm run dev");
    console.log("2. Open: http://localhost:3000/admin");
    console.log("3. Login with admin credentials");
    console.log("4. Navigate to 'CMS' section to edit landing page content\n");

  } catch (error) {
    console.error("❌ Payload Initialization Failed:", error);
    console.log("\n💡 Troubleshooting:");
    console.log("1. Make sure PostgreSQL is running");
    console.log("2. Check DATABASE_URL in .env");
    console.log("3. Verify database 'gurupro_db' exists");
    process.exit(1);
  }
}

// Run the initialization
initPayload();
