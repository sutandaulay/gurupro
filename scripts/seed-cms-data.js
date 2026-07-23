const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'gurupro_db',
  user: 'postgres',
  password: 'nus4nt4r4',
});
async function seed() {
  await client.connect();

  // Seed hero
  const heroData = {
    badge: "✨ Didukung VideaClass AI",
    headline: "Administrasi Guru Lebih Cepat dengan AI",
    subheadline: "GuruPRO AI hadir untuk membantu guru membuat RPP, absensi, jurnal mengajar, hingga rapor — semua dalam satu platform, didukung kecerdasan buatan.",
    stats: [
      { number: "50.000+", label: "Guru Aktif" },
      { number: "6", label: "Modul Lengkap" },
      { number: "10x", label: "Lebih Cepat" }
    ]
  };
  await client.query(
    `INSERT INTO system_settings (key, value) VALUES ('landing_hero', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(heroData)]
  );
  console.log('✅ Hero seeded');

  // Seed footer
  const footerData = {
    description: "Platform administrasi guru berbasis AI untuk membantu guru Indonesia.",
    contactEmail: "support@gurupro.id",
    contactWhatsapp: "+62 812-8396-0337",
    copyrightText: "GuruPRO AI © 2026",
    links: [
      { label: "Beranda", url: "/", column: "links" },
      { label: "Fitur", url: "/#fitur", column: "links" }
    ],
    socialLinks: [
      { platform: "facebook", url: "https://facebook.com/guruproai" }
    ]
  };
  await client.query(
    `INSERT INTO system_settings (key, value) VALUES ('landing_footer', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(footerData)]
  );
  console.log('✅ Footer seeded');

  // Seed chatbot
  const chatbotData = {
    isEnabled: false,
    welcomeMessage: "Halo! Saya asisten AI GuruPRO.",
    humanCSUrl: ""
  };
  await client.query(
    `INSERT INTO system_settings (key, value) VALUES ('landing_chatbot', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(chatbotData)]
  );
  console.log('✅ Chatbot seeded');

  // Seed FAQ
  const faqData = [
    { question: "Bagaimana cara kerja Poin kuota?", answer: "Poin dipotong setiap kali generate soal." },
    { question: "Metode pembayaran apa saja?", answer: "QRIS, GoPay, OVO, Dana, VA." }
  ];
  await client.query(
    `INSERT INTO system_settings (key, value) VALUES ('faq_config', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(faqData)]
  );
  console.log('✅ FAQ seeded');

  // Seed Referral
  const referralData = {
    badge: "🎁 Program Kemitraan",
    title: "Bagikan GuruPro, Dapatkan Cashback!",
    description: "Dapatkan cashback Rp10.000 untuk setiap guru yang mendaftar.",
    benefits: [
      { icon: "💰", title: "Cashback", description: "Rp10.000 per subscriber" },
      { icon: "⚡", title: "Poin", description: "+20 Poin gratis" }
    ],
    ctaText: "Mulai Undang",
    ctaLink: ""
  };
  await client.query(
    `INSERT INTO system_settings (key, value) VALUES ('referral_config', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(referralData)]
  );
  console.log('✅ Referral seeded');

  await client.end();
  console.log('\n🎉 All CMS data seeded!');
}
seed();
