/**
 * Complete Payload CMS Initialization
 * Run: npx tsx scripts/init-all-payload.ts
 */

import { pool } from "../lib/db";

async function initAll() {
  console.log('=== COMPLETE PAYLOAD CMS INITIALIZATION ===\n');

  try {
    // 1. Footer Content
    console.log('1. Footer Content...');
    const footerCheck = await pool.query('SELECT id FROM payload.footer_content LIMIT 1');
    if (footerCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO payload.footer_content (
          description, contact_email, contact_whatsapp, copyright_text,
          created_at, updated_at
        ) VALUES (
          'Platform administrasi guru berbasis AI untuk membantu guru Indonesia.',
          'support@gurupro.id', '+62 812-8396-0337', 'GuruPRO AI © 2026',
          NOW(), NOW()
        )
      `);
      console.log('   ✅ Created');

      const footer = await pool.query('SELECT id FROM payload.footer_content LIMIT 1');
      const fid = footer.rows[0].id;

      // Insert links (using escaped column name)
      const links = [
        ['Beranda', '/', 'links'],
        ['Fitur', '/#fitur', 'links'],
        ['Harga', '/#harga', 'links'],
        ['Blog', '/blog', 'links'],
        ['Kebijakan Privasi', '/kebijakan-privasi', 'links'],
        ['Syarat & Ketentuan', '/syarat-ketentuan', 'links'],
      ];

      for (const [label, url, col] of links) {
        await pool.query(
          `INSERT INTO payload.footer_content_links (parent, label, url, "${col}") VALUES ($1, $2, $3, $4)`,
          [fid, label, url, col]
        );
      }
      console.log('   ✅ 6 links added');

      // Social links
      const social = [
        ['facebook', 'https://facebook.com/guruproai'],
        ['instagram', 'https://instagram.com/guruproai'],
        ['youtube', 'https://youtube.com/@guruproai'],
        ['tiktok', 'https://tiktok.com/@guruproai'],
      ];

      for (const [p, u] of social) {
        await pool.query(
          `INSERT INTO payload.footer_content_social_links (parent, platform, url) VALUES ($1, $2, $3)`,
          [fid, p, u]
        );
      }
      console.log('   ✅ 4 social links added');
    } else {
      console.log('   ℹ️ Already exists');
    }

    // 2. Chatbot Config
    console.log('\n2. Chatbot Config...');
    const chatbotCheck = await pool.query('SELECT COUNT(*) FROM payload.chatbot_config');
    if (parseInt(chatbotCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO payload.chatbot_config (
          is_enabled, welcome_message, system_prompt, human_c_s_url,
          created_at, updated_at
        ) VALUES (
          false,
          'Halo! 👋 Saya asisten AI GuruPRO. Ada yang bisa saya bantu?',
          'Kamu adalah Customer Service Assistant untuk platform GuruPRO AI.',
          'https://wa.me/6281283960337',
          NOW(), NOW()
        )
      `);
      console.log('   ✅ Created');
    } else {
      console.log('   ℹ️ Already exists');
    }

    // 3. Final verification
    console.log('\n=== VERIFICATION ===\n');
    const tables = [
      { name: 'cms_features', sql: 'SELECT COUNT(*) FROM payload.cms_features' },
      { name: 'why_points', sql: 'SELECT COUNT(*) FROM payload.why_points' },
      { name: 'landing_page', sql: 'SELECT COUNT(*) FROM payload.landing_page' },
      { name: 'footer_content', sql: 'SELECT COUNT(*) FROM payload.footer_content' },
      { name: 'chatbot_config', sql: 'SELECT COUNT(*) FROM payload.chatbot_config' },
    ];

    for (const t of tables) {
      const res = await pool.query(t.sql);
      const count = parseInt(res.rows[0].count);
      console.log(`${count > 0 ? '✅' : '⚠️ '} ${t.name}: ${count} rows`);
    }

    console.log('\n=== ALL DONE ===');

  } catch (e) {
    console.error('Error:', e);
  }

  await pool.end();
}

initAll().catch(e => {
  console.error(e);
  process.exit(1);
});
