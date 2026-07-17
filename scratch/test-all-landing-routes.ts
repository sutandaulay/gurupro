import { query } from "../lib/db";

async function runTests() {
  console.log("🧪 Memulai verifikasi semua menu CMS Landing Page...");

  // 1. Uji Menu Fitur (cms_features)
  try {
    const res = await query(
      'SELECT id, icon, title, description, "order" as "sortOrder", is_active as "isActive" FROM cms_features ORDER BY "order" ASC'
    );
    console.log("✅ Fitur (Features): SELECT sukses! Jumlah baris:", res.rows.length);
  } catch (err: any) {
    console.error("❌ Fitur (Features) gagal:", err.message);
  }

  // 2. Uji Menu Token Ekstra (addon_token_packages)
  try {
    const res = await query("SELECT * FROM addon_token_packages ORDER BY sort_order ASC, created_at ASC");
    console.log("✅ Token Ekstra (Addon): SELECT sukses! Jumlah baris:", res.rows.length);
  } catch (err: any) {
    console.error("❌ Token Ekstra (Addon) gagal:", err.message);
  }

  // 3. Uji Menu Kategori (categories)
  try {
    const res = await query("SELECT id, title, slug, description, color FROM categories LIMIT 1");
    console.log("✅ Kategori (Categories): SELECT sukses! Baris pertama:", res.rows);
  } catch (err: any) {
    console.error("❌ Kategori (Categories) gagal:", err.message);
  }

  // 4. Uji Menu Artikel (posts)
  try {
    const res = await query(
      `SELECT p.id, p.title, p.slug, p.author, p.published_date as published_at, 
              p.category_id, p.featured_image_id, p.excerpt, p.content, p.status, 
              p.created_at, p.updated_at, c.title as category_title, c.slug as category_slug
       FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.updated_at DESC
       LIMIT 1`
    );
    console.log("✅ Artikel (Posts): SELECT sukses! Baris pertama:", res.rows);
  } catch (err: any) {
    console.error("❌ Artikel (Posts) gagal:", err.message);
  }

  process.exit(0);
}

runTests();
