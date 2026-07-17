import { query } from "../lib/db";

async function main() {
  try {
    const res = await query(
      'SELECT id, icon, title, description, "order" as "sortOrder", "isActive" FROM cms_features ORDER BY "order" ASC'
    );
    console.log("✅ SELECT success. Rows count:", res.rows.length);
  } catch (err: any) {
    console.error("❌ SELECT failed:", err.message);
  }
  process.exit(0);
}

main();
