import { pool } from "../lib/db";
import fs from "fs";
import path from "path";

async function main() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, "../migrations/mulri-school-deep-learning.sql");
    console.log("Reading SQL from:", sqlPath);
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing SQL migration...");
    await client.query(sql);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration execution failed:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

main();
