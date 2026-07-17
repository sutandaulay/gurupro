import { ensureDbInitialized, query } from "@/lib/db";

async function main() {
  console.log("⏳ Running DB init (lib/db.ts initDb)...");
  await ensureDbInitialized();
  console.log("✅ initDb completed");

  const tables = [
    "cms_landing",
    "system_settings",
    "pricing_plans",
    "addon_token_packages",
  ];

  for (const t of tables) {
    const r = await query(
      `SELECT COUNT(*)::int AS cnt FROM ${t}`
    );
    console.log(`• ${t}: ${r.rows[0].cnt} rows`);
  }

  console.log("🎉 Done. CMS tables created & seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ FAILED:", e);
    process.exit(1);
  });
