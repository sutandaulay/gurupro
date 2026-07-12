import { query } from "../lib/db";

async function main() {
  try {
    const usersCol = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    console.log("=== COLUMNS IN users ===");
    console.log(usersCol.rows.map(r => `${r.column_name} (${r.data_type})`));

    const cmsUsersCol = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cms_users' 
      ORDER BY ordinal_position
    `);
    console.log("\n=== COLUMNS IN cms_users ===");
    console.log(cmsUsersCol.rows.map(r => `${r.column_name} (${r.data_type})`));

    const usersData = await query("SELECT id, email, nama_lengkap, role FROM users LIMIT 3");
    console.log("\n=== DATA IN users ===");
    console.log(usersData.rows);

    const cmsUsersData = await query("SELECT id, email, name, role FROM cms_users LIMIT 3");
    console.log("\n=== DATA IN cms_users ===");
    console.log(cmsUsersData.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

main();
