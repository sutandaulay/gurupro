import { query } from "../lib/db";

async function main() {
  try {
    const res = await query("SELECT * FROM addon_token_packages");
    console.log("ADDON PACKAGES IN DB:", res.rows.length);
    console.log(res.rows);
  } catch (err) {
    console.error("Error querying addon_token_packages:", err);
  } finally {
    process.exit(0);
  }
}

main();
