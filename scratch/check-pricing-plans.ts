import { query } from "../lib/db";

async function main() {
  try {
    const res = await query("SELECT * FROM pricing_plans");
    console.log("PRICING PLANS ROWS COUNT:", res.rows.length);
    console.log("ROWS:");
    console.log(res.rows);
  } catch (err) {
    console.error("Error querying pricing_plans:", err);
  } finally {
    process.exit(0);
  }
}

main();
