import { query } from "../lib/db";

async function main() {
  try {
    const res = await query("SELECT pg_terminate_backend(9456)");
    console.log("TERMINATE RESULT:", res.rows);
  } catch (err) {
    console.error("Error terminating backend:", err);
  } finally {
    process.exit(0);
  }
}

main();
