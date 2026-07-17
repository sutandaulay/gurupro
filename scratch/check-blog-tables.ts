import { pool } from "../lib/db";

async function main() {
  const tables = ["posts", "categories"];
  for (const table of tables) {
    try {
      const res = await pool.query(`
        SELECT table_schema, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}'
      `);
      if (res.rows.length > 0) {
        console.log(`✅ Table '${table}' exists. Columns (Schema: ${res.rows[0].table_schema}):`);
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
