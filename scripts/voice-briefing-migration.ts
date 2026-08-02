import dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), ".env.local") });
dotenv.config({ path: join(process.cwd(), ".env") });

import { Pool } from "pg";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10),
});


async function migrate() {
  const queries = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`,
    `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS start_time TIME`,
    `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS end_time TIME`,
    `CREATE TABLE IF NOT EXISTS notification_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      voice_briefing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      voice_name_preference TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences (user_id)`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription JSONB NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT,
      auth TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, endpoint)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id)`,
    `CREATE TABLE IF NOT EXISTS voice_briefing_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, schedule_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_voice_briefing_logs_user ON voice_briefing_logs (user_id, sent_at)`,
  ];

  for (const sql of queries) {
    try {
      await pool.query(sql);
      console.log("OK:", sql.split("\n")[0].substring(0, 80));
    } catch (err: any) {
      console.error("FAIL:", sql.split("\n")[0].substring(0, 80), err.message);
    }
  }

  const checks = [
    ["users.gender", `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gender'`],
    ["schedules.start_time", `SELECT column_name FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'start_time'`],
    ["notification_preferences", `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_preferences'`],
    ["push_subscriptions", `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_subscriptions'`],
    ["voice_briefing_logs", `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_briefing_logs'`],
  ];

  console.log("\n=== VERIFICATION ===");
  for (const [name, sql] of checks) {
    const res = await pool.query(sql);
    console.log(name, res.rows.length > 0 ? "EXISTS" : "MISSING");
  }

  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration script error:", err);
  process.exit(1);
});
