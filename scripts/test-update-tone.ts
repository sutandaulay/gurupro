import { query } from "@/lib/db";

async function main() {
  try {
    // Ambil 1 user
    const u = await query("SELECT id FROM users LIMIT 1");
    if (!u.rows.length) {
      console.log("Tidak ada user");
      process.exit(0);
    }
    const userId = u.rows[0].id;

    // Simulasikan SET notification_tone seperti di PUT handler
    const sets = ["notification_tone = $1"];
    const values = ["hangat"];
    const res = await query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $2`,
      [...values, userId]
    );
    console.log("UPDATE berhasil, rowCount:", res.rowCount);
  } catch (e: any) {
    console.error("Gagal UPDATE:", e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
