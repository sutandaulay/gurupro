import { query } from "../lib/db";

async function main() {
  try {
    console.log("Dropping payload.bahan_ajar table cascade...");
    await query(`
      DROP TABLE IF EXISTS "payload"."bahan_ajar" CASCADE;
    `);
    console.log("Table dropped successfully!");
  } catch (error) {
    console.error("Failed to run alter table query:", error);
  }
  process.exit(0);
}

main();
