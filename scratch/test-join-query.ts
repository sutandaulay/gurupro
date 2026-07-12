import { query } from "../lib/db";

async function main() {
  try {
    // Let's get a user UUID first
    const userId = "4e5ee3bd-7c7d-47cf-ab6a-1a99fd931e88";
    console.log(`Testing with user UUID: ${userId}`);

    const joinRes = await query(
      "SELECT cu.id as cms_user_id FROM cms_users cu JOIN users u ON LOWER(cu.email) = LOWER(u.email) WHERE u.id = $1",
      [userId]
    );
    console.log("Join result:", joinRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

main();
