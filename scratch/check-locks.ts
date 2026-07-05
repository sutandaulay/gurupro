import { query } from "../lib/db";

async function main() {
  try {
    const res = await query(`
      SELECT pid, query, state, wait_event_type, wait_event 
      FROM pg_stat_activity 
      WHERE state IS NOT NULL AND pid <> pg_backend_pid()
    `);
    console.log("ACTIVE DB ACTIVITIES:");
    console.log(res.rows);
  } catch (err) {
    console.error("Error checking DB activities:", err);
  } finally {
    process.exit(0);
  }
}

main();
