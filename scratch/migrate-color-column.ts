import { pool } from "../lib/db";

async function main() {
  try {
    await pool.query("ALTER TABLE payload.categories ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT '#4f46e5'");
    console.log("✅ Column 'color' added/verified in payload.categories successfully!");
  } catch (err: any) {
    console.error("❌ Failed to add color column:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
