import { query } from "../lib/db";

async function main() {
  try {
    const res = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pricing_plans'
    `);
    console.log("COLUMNS FOR pricing_plans:");
    console.log(res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

main();
