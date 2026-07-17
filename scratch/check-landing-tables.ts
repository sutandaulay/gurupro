import { pool } from "../lib/db";

async function main() {
  const tables = [
    "cms_features",
    "why_points",
    "cms_landing",
    "addon_token_packages",
    "system_settings"
  ];

  for (const table of tables) {
    try {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}'
      `);
      if (res.rows.length > 0) {
        console.log(`✅ Table '${table}' exists. Columns:`);
        res.rows.forEach((col: any) => console.log(`  - ${col.column_name} (${col.data_type})`));
      } else {
        console.log(`❌ Table '${table}' DOES NOT exist!`);
      }
    } catch (e: any) {
      console.error(`Error checking '${table}':`, e.message);
    }
  }
  process.exit(0);
}

main();
