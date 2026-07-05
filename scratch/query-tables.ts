import { query } from "../lib/db";

async function main() {
  try {
    const res = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log("TABLES IN DATABASE:");
    console.log(res.rows.map(r => r.table_name));
    
    // Check if new columns exist in guru_administrasi
    const colRes = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'guru_administrasi' 
        AND column_name IN ('school_id', 'dimensi8', 'tiga_pengalaman', 'pai_mode')
    `);
    console.log("\nCOLUMNS IN GURU_ADMINISTRASI:");
    console.log(colRes.rows);
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    process.exit(0);
  }
}

main();
