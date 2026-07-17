import { query } from "../lib/db";

async function main() {
  console.log("Testing SELECT queries...");
  try {
    const res = await query("SELECT id, title, slug, author, published_at FROM posts LIMIT 1");
    console.log("✅ SELECT posts success:", res.rows);
  } catch (err: any) {
    console.error("❌ SELECT posts failed:", err.message);
  }

  try {
    const res = await query("SELECT id, title, slug, description, color FROM categories LIMIT 1");
    console.log("✅ SELECT categories success:", res.rows);
  } catch (err: any) {
    console.error("❌ SELECT categories failed:", err.message);
  }
  process.exit(0);
}

main();
