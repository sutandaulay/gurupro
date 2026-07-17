/**
 * Initialize Payload CMS Content - Direct Database Insert
 * Run: npx tsx scripts/init-payload-content.ts
 */

import { pool } from "../lib/db";

async function seedPayloadContent() {
  console.log('=== PAYLOAD CMS CONTENT INITIALIZATION ===\n');

  try {
    // ==========================================
    // 1. SEED FEATURES (cms_features table)
    // ==========================================
    console.log('📝 Seeding Features...');

    const existingFeatures = await pool.query('SELECT COUNT(*) FROM payload.cms_features');
    if (parseInt(existingFeatures.rows[0].count) === 0) {
      const features = [
        {
          title: 'Pembuat RPP AI',
          description: 'Buat RPP sesuai Kurikulum Merdeka otomatis dalam hitungan menit. Cukup masukkan topik dan kelas, AI akan menyusun RPP lengkap dengan tujuan pembelajaran, kegiatan, dan asesmen.',
          icon: 'IconFileTextAi',
          order: 0,
          is_active: true
        },
        {
          title: 'Jurnal Mengajar',
          description: 'Catat aktivitas harian kelas dengan mudah dan cepat. Jurnal tersinkronisasi otomatis dengan RPP dan kalender akademik sekolah.',
          icon: 'IconBook2',
          order: 1,
          is_active: true
        },
        {
          title: 'Absensi Digital',
          description: 'Kelola kehadiran siswa secara digital, lengkap dengan rekap otomatis dan ekspor ke Excel. Orang tua juga mendapat notifikasi kehadiran.',
          icon: 'IconClipboardCheck',
          order: 2,
          is_active: true
        },
        {
          title: 'Buku Nilai & Rapor',
          description: 'Input nilai, hitung otomatis berdasarkan bobot penilaian, dan cetak rapor siap pakai. Mendukung berbagai format rapor Kurikulum Merdeka dan K13.',
          icon: 'IconReportAnalytics',
          order: 3,
          is_active: true
        },
        {
          title: 'PKG & SKP',
          description: 'Bantu proses Penilaian Kinerja Guru dan Sasaran Kinerja Pegawai dengan panduan AI. Lengkap dengan template dokumen yang sesuai regulasi.',
          icon: 'IconAward',
          order: 4,
          is_active: true
        },
        {
          title: 'Komunikasi Orang Tua',
          description: 'Kirim notifikasi perkembangan siswa ke wali murid secara real-time. Fitur chat dan laporan periodik memudahkan kolaborasi sekolah dengan orang tua.',
          icon: 'IconMessages',
          order: 5,
          is_active: true
        },
      ];

      for (const f of features) {
        await pool.query(
          `INSERT INTO payload.cms_features (title, description, icon, "order", is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [f.title, f.description, f.icon, f.order, f.is_active]
        );
      }
      console.log(`  ✅ Created ${features.length} features`);
    } else {
      console.log(`  ℹ️  Features already exist (${existingFeatures.rows[0].count}), skipping`);
    }

    // ==========================================
    // 2. SEED WHY POINTS (why_points table)
    // ==========================================
    console.log('\n📝 Seeding Why Points...');

    const existingWhy = await pool.query('SELECT COUNT(*) FROM payload.why_points');
    if (parseInt(existingWhy.rows[0].count) === 0) {
      const whyPoints = [
        { point: 'Sesuai regulasi Kemenag & Kemendikbud terbaru', order: 0, is_active: true },
        { point: 'Tersedia offline-first, cocok untuk daerah sinyal lemah', order: 1, is_active: true },
        { point: 'Harga terjangkau, mulai Rp 49.000/bulan', order: 2, is_active: true },
        { point: 'Data tersimpan aman, sesuai UU PDP No. 27/2022', order: 3, is_active: true },
      ];

      for (const w of whyPoints) {
        await pool.query(
          `INSERT INTO payload.why_points (point, "order", is_active, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [w.point, w.order, w.is_active]
        );
      }
      console.log(`  ✅ Created ${whyPoints.length} why points`);
    } else {
      console.log(`  ℹ️  Why points already exist, skipping`);
    }

    // ==========================================
    // 3. SEED LANDING PAGE (landing_page table)
    // ==========================================
    console.log('\n📝 Seeding Landing Page...');

    const existingLanding = await pool.query('SELECT COUNT(*) FROM payload.landing_page');
    if (parseInt(existingLanding.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO payload.landing_page (
          hero_badge_text, hero_headline, hero_subheadline,
          created_at, updated_at
        ) VALUES (
          '✨ Didukung VideaClass AI',
          'Administrasi Guru Lebih Cepat dengan AI',
          'GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.',
          NOW(), NOW()
        )
      `);
      console.log('  ✅ Created landing page');
    } else {
      console.log('  ℹ️  Landing page already exists, skipping');
    }

    // ==========================================
    // 4. SEED FOOTER CONTENT (footer_content table)
    // ==========================================
    console.log('\n📝 Seeding Footer Content...');

    const existingFooter = await pool.query('SELECT COUNT(*) FROM payload.footer_content');
    if (parseInt(existingFooter.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO payload.footer_content (
          description, contact_email, contact_whatsapp, copyright_text,
          created_at, updated_at
        ) VALUES (
          'Platform administrasi guru berbasis AI untuk membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor dalam satu platform.',
          'support@gurupro.id',
          '+62 812-8396-0337',
          'GuruPRO AI © 2026',
          NOW(), NOW()
        )
      `);

      // Get footer ID and insert links
      const footer = await pool.query('SELECT id FROM payload.footer_content LIMIT 1');
      if (footer.rows.length > 0) {
        const footerId = footer.rows[0].id;

        const links = [
          { label: 'Beranda', url: '/', column: 'links' },
          { label: 'Fitur', url: '/#fitur', column: 'links' },
          { label: 'Harga', url: '/#harga', column: 'links' },
          { label: 'Blog', url: '/blog', column: 'links' },
          { label: 'Kebijakan Privasi', url: '/kebijakan-privasi', column: 'links' },
          { label: 'Syarat & Ketentuan', url: '/syarat-ketentuan', column: 'links' },
        ];

        for (const link of links) {
          await pool.query(
            `INSERT INTO payload.footer_content_links ("parent", label, url, column)
             VALUES ($1, $2, $3, $4)`,
            [footerId, link.label, link.url, link.column]
          );
        }

        const socialLinks = [
          { platform: 'facebook', url: 'https://facebook.com/guruproai' },
          { platform: 'instagram', url: 'https://instagram.com/guruproai' },
          { platform: 'youtube', url: 'https://youtube.com/@guruproai' },
          { platform: 'tiktok', url: 'https://tiktok.com/@guruproai' },
        ];

        for (const social of socialLinks) {
          await pool.query(
            `INSERT INTO payload.footer_content_social_links ("parent", platform, url)
             VALUES ($1, $2, $3)`,
            [footerId, social.platform, social.url]
          );
        }

        console.log(`  ✅ Created footer with ${links.length} links and ${socialLinks.length} social links`);
      }
    } else {
      console.log('  ℹ️  Footer content already exists, skipping');
    }

    // ==========================================
    // 5. SEED CHATBOT CONFIG (chatbot_config table)
    // ==========================================
    console.log('\n📝 Seeding Chatbot Config...');

    const existingChatbot = await pool.query('SELECT COUNT(*) FROM payload.chatbot_config');
    if (parseInt(existingChatbot.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO payload.chatbot_config (
          is_enabled, welcome_message, system_prompt, human_c_s_url,
          created_at, updated_at
        ) VALUES (
          false,
          'Halo! 👋 Saya asisten AI GuruPRO. Ada yang bisa saya bantu? Silakan tanyakan tentang cara menggunakan platform, fitur-fitur yang tersedia, atau masalah yang Anda hadapi.',
          'Kamu adalah Customer Service Assistant untuk platform GuruPRO AI. GuruPRO adalah platform administrasi guru berbasis AI yang membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor. Selalu jawab dengan ramah dalam Bahasa Indonesia.',
          'https://wa.me/6281283960337',
          NOW(), NOW()
        )
      `);
      console.log('  ✅ Created chatbot config');
    } else {
      console.log('  ℹ️  Chatbot config already exists, skipping');
    }

    // ==========================================
    // VERIFICATION
    // ==========================================
    console.log('\n📊 Content Verification:\n');

    const tables = [
      { name: 'cms_features', check: 'SELECT COUNT(*) FROM payload.cms_features' },
      { name: 'why_points', check: 'SELECT COUNT(*) FROM payload.why_points' },
      { name: 'landing_page', check: 'SELECT COUNT(*) FROM payload.landing_page' },
      { name: 'footer_content', check: 'SELECT COUNT(*) FROM payload.footer_content' },
      { name: 'chatbot_config', check: 'SELECT COUNT(*) FROM payload.chatbot_config' },
    ];

    for (const t of tables) {
      const res = await pool.query(t.check);
      const count = parseInt(res.rows[0].count);
      console.log(`  ${count > 0 ? '✅' : '⚠️ '}${t.name}: ${count} row(s)`);
    }

    console.log('\n=== INITIALIZATION COMPLETE ===');

  } catch (e) {
    console.error('Error:', e);
  }

  await pool.end();
}

seedPayloadContent().catch((e) => {
  console.error(e);
  process.exit(1);
});
