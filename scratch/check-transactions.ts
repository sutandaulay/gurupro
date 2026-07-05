import { query } from "../lib/db";

async function main() {
  try {
    const res = await query(`
      SELECT pid, query, state, age(clock_timestamp(), query_start) AS query_duration, wait_event_type, wait_event 
      FROM pg_stat_activity 
      WHERE state = 'idle in transaction' OR state = 'active'
    `);
    console.log("ACTIVE OR IDLE IN TRANSACTION ACTIVITIES:");
    console.log(res.rows);
  } catch (err) {
    console.error("Error checking activities:", err);
  } finally {
    process.exit(0);
  }
}

main();
