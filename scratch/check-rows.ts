import { query } from "../lib/db";

async function main() {
  try {
    const res = await query(`
      SELECT id, guru_id, status, created_at 
      FROM "payload"."bahan_ajar" 
      LIMIT 10;
    `);
    console.log("Rows in payload.bahan_ajar:", res.rows);
  } catch (error) {
    console.error("Error reading rows:", error);
  }
  process.exit(0);
}

main();
