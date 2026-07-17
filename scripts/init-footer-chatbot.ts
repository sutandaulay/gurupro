/**
 * Seed Footer and Chatbot Content Only
 * Run: npx tsx scripts/init-footer-chatbot.ts
 */

import { pool } from "../lib/db";

async function seedFooterChatbot() {
  console.log('=== SEED FOOTER & CHATBOT ===\n');

  try {
    // Check existing
    const existingFooter = await pool.query('SELECT id FROM payload.footer_content LIMIT 1');
    if (existingFooter.rows.length === 0) {
      console.log('📝 Creating footer content...');
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
      console.log('  ✅ Footer created');

      // Get ID
      const footer = await pool.query('SELECT id FROM payload.footer_content LIMIT 1');
      const footerId = footer.rows[0].id;

      // Check links table structure
      const linkCols = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'payload' AND table_name = 'footer_content_links'
      `);
      console.log('\nfooter_content_links columns:', linkCols.rows.map(r => r.column_name));

      // Insert links - using proper escaping
      const links = [
        ['Beranda', '/', 'links'],
        ['Fitur', '/#fitur', 'links'],
        ['Harga', '/#harga', 'links'],
        ['Blog', '/blog', 'links'],
        ['Kebijakan Privasi', '/kebijakan-privasi', 'links'],
        ['Syarat & Ketentuan', '/syarat-ketentuan', 'links'],
      ];

      for (const [label, url, col] of links) {
        try {
          await pool.query(
            `INSERT INTO payload.footer_content_links (parent, label, url, ${pool.query('').constructor.name === 'function' ? '' : ''}"${col}")
             VALUES ($1, $2, $3, $4)`,
            [footerId, label, url, col]
          );
        } catch (e) {
          // Try alternative
          await pool.query(
            `INSERT INTO payload.footer_content_links (parent, label, url, col) VALUES ($1, $2, $3, $4)`,
            [footerId, label, url, col]
          );
        }
      }
      console.log(`  ✅ ${links.length} links added`);

      // Social links
      const social = [
        ['facebook', 'https://facebook.com/guruproai'],
        ['instagram', 'https://instagram.com/guruproai'],
        ['youtube', 'https://youtube.com/@guruproai'],
        ['tiktok', 'https://tiktok.com/@guruproai'],
      ];

      for (const [platform, url] of social) {
        try {
          await pool.query(
            `INSERT INTO payload.footer_content_social_links (parent, platform, url) VALUES ($1, $2, $3)`,
            [footerId, platform, url]
          );
        } catch (e) {
          console.log(`    ⚠️ Social link ${platform}: ${e.message.substring(0, 50)}`);
        }
      }
      console.log(`  ✅ Social links added`);
    } else {
      console.log('ℹ️  Footer already exists');
    }

    // Chatbot config
    const existingChatbot = await pool.query('SELECT COUNT(*) FROM payload.chatbot_config');
    if (parseInt(existingChatbot.rows[0].count) === 0) {
      console.log('\n📝 Creating chatbot config...');
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
      console.log('  ✅ Chatbot config created');
    } else {
      console.log('\nℹ️  Chatbot config already exists');
    }

    console.log('\n=== DONE ===');

  } catch (e) {
    console.error('Error:', e);
  }

  await pool.end();
}

seedFooterChatbot().catch(console.error);
