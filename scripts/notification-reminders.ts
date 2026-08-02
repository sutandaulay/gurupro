/**
 * Notification Reminders Cron Job
 *
 * Sends various notifications to users:
 * 1. Token Low Alert - When tokens < 10 (WhatsApp) or < 5 (In-app)
 * 2. Teaching Start Reminder - 15 minutes before class starts
 * 3. Teaching End Reminder - 30 minutes before class ends
 *
 * Usage:
 *   npx tsx scripts/notification-reminders.ts [all|token|teaching]
 *
 * Environment Variables:
 *   NEXT_PUBLIC_APP_URL - Base URL of the app (default: http://localhost:3000)
 *   CRON_SECRET - Secret for cron authentication
 *
 * For Vercel Cron:
 *   Add to vercel.json: { "cron": "*/15 * * * *", "path": "/api/cron/notification-reminders" }
 */

import { pool, query } from "@/lib/db";
import { sendWhatsAppNotification } from "../lib/notifications";
import { sendInAppNotification } from "@/lib/institution-members";

// Get app URL with fallback
function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://gurupro.id";
  // Remove trailing slash
  return appUrl.replace(/\/$/, "");
}

// ==========================================
// TOKEN LOW ALERT
// ==========================================

interface TokenAlertUser {
  id: string;
  email: string;
  whatsapp: string | null;
  nama_lengkap: string | null;
  quota_poin_available: number;
  addon_poin_available: number;
  status_langganan: string | null;
  last_token_warning_sent: string | null;
}

async function checkAndSendTokenAlerts(): Promise<{ sent: number; skipped: number; errors: number }> {
  console.log("[CRON] Checking for low token users...");

  const result = { sent: 0, skipped: 0, errors: 0 };
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const appUrl = getAppUrl();

  try {
    // Get users with low tokens (only active subscribers)
    const usersRes = await query(`
      SELECT
        id,
        email,
        whatsapp,
        nama_lengkap,
        GREATEST(0, COALESCE(quota_poin_total, 0) - COALESCE(quota_poin_used, 0)) as quota_poin_available,
        GREATEST(0, COALESCE(addon_poin, 0) - COALESCE(addon_poin_used, 0)) as addon_poin_available,
        status_langganan,
        last_token_warning_sent
      FROM users
      WHERE is_active = true
        AND (status_langganan IS NOT NULL AND status_langganan != 'free')
        AND (
          GREATEST(0, COALESCE(quota_poin_total, 0) - COALESCE(quota_poin_used, 0)) <= 10
          OR (
            GREATEST(0, COALESCE(quota_poin_total, 0) - COALESCE(quota_poin_used, 0)) <= 5
            AND GREATEST(0, COALESCE(addon_poin, 0) - COALESCE(addon_poin_used, 0)) <= 0
          )
        )
        AND (
          last_token_warning_sent IS NULL
          OR last_token_warning_sent != $1
        )
    `, [today]);

    console.log(`[CRON] Found ${usersRes.rows.length} users needing token warning`);

    for (const user of usersRes.rows as TokenAlertUser[]) {
      try {
        const totalTokens = user.quota_poin_available + user.addon_poin_available;
        const userName = user.nama_lengkap || "Guru";

        // Determine severity
        const isCritical = totalTokens <= 5;
        const isLow = totalTokens <= 10;

        if (!isLow) {
          result.skipped++;
          continue;
        }

        // Prepare WhatsApp message
        const waMessage = `[GuruPRO] ⚠️ Peringatan Token Hampir Habis!

Yth. *${userName}*,

Kuota token AI Anda hampir habis! Sisa token Anda saat ini: *${totalTokens} token*.

${isCritical ? '⚠️ KUOTA SANGAT TERBATAS - Segera lakukan top-up!' : ''}

Jangan sampai aktivitas mengajar terganggu. Top-up sekarang di:
${appUrl}/dashboard/billing

---
Pesan otomatis dari Sistem GuruPRO
Hubungi admin jika butuh bantuan.`;

        // Send WhatsApp notification
        if (user.whatsapp) {
          await sendWhatsAppNotification(user.whatsapp, waMessage);
          console.log(`[CRON] Sent token warning WhatsApp to ${user.nama_lengkap} (${user.whatsapp})`);
        }

        // Send in-app notification
        await sendInAppNotification(
          user.id,
          isCritical ? "⚠️ Kuota Poin Sangat Terbatas!" : "⚠️ Kuota Poin Menipis",
          `Sisa poin Anda: ${totalTokens}. ${isCritical ? 'Segera top-up untuk melanjutkan aktivitas.' : 'Pertimbangkan untuk top-up.'}`,
          isCritical ? "token_critical" : "token_low",
          "token_balance",
          null
        );

        // Update last warning sent date
        await query(
          "UPDATE users SET last_token_warning_sent = $1 WHERE id = $2",
          [today, user.id]
        );

        result.sent++;
      } catch (err: any) {
        console.error(`[CRON] Error sending token warning to user ${user.id}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("[CRON] Token alert check failed:", err.message);
  }

  console.log(`[CRON] Token alerts completed: ${result.sent} sent, ${result.skipped} skipped, ${result.errors} errors`);
  return result;
}

// ==========================================
// TEACHING REMINDERS
// ==========================================

interface TeachingReminderUser {
  user_id: string;
  user_name: string | null;
  whatsapp: string | null;
  schedule_id: number;
  school_name: string;
  class_name: string;
  mapel_name: string;
  jam_mulai: string;
  jam_selesai: string;
  hari: number; // 0=Sunday, 1=Monday, etc.
}

async function sendTeachingReminders(): Promise<{ startReminders: number; endReminders: number; errors: number }> {
  console.log("[CRON] Checking for teaching reminders...");

  const result = { startReminders: 0, endReminders: 0, errors: 0 };
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const appUrl = getAppUrl();

  try {
    // Get teaching schedules that need reminders
    // Start reminder: 15 minutes before class
    // End reminder: 30 minutes before class ends
    const schedulesRes = await query(`
      SELECT DISTINCT ON (ts.id)
        ts.id as schedule_id,
        ts.user_id,
        u.nama_lengkap as user_name,
        u.whatsapp,
        s.nama_sekolah as school_name,
        k.nama_kelas as class_name,
        m.nama_mapel as mapel_name,
        ts.jam_mulai,
        ts.jam_selesai,
        EXTRACT(DOW FROM ts.hari) as hari
      FROM teacher_schedules ts
      JOIN users u ON u.id = ts.user_id
      JOIN schools s ON s.id = ts.school_id
      JOIN kelas k ON k.id = ts.kelas_id
      JOIN mapel m ON m.id = ts.mapel_id
      WHERE u.is_active = true
        AND u.whatsapp IS NOT NULL
        AND ts.is_active = true
        AND ts.hari = CURRENT_DATE
    `);

    console.log(`[CRON] Found ${schedulesRes.rows.length} active teaching schedules today`);

    for (const schedule of schedulesRes.rows as TeachingReminderUser[]) {
      try {
        // Parse schedule times
        const [startHour, startMin] = schedule.jam_mulai.split(':').map(Number);
        const [endHour, endMin] = schedule.jam_selesai.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        const userName = schedule.user_name || "Guru";
        const classInfo = `${schedule.class_name} - ${schedule.mapel_name}`;
        const schoolInfo = schedule.school_name;

        // Check if we should send start reminder (15 min before)
        const startDiff = startMinutes - currentMinutes;
        if (startDiff > 0 && startDiff <= 15) {
          // Send start reminder
          const waMessage = `[GuruPRO] ⏰ Pengingat Mulai Mengajar!

Yth. *${userName}*,

⏱️ Mengajar akan dimulai dalam *${startDiff} menit*!

📚 ${classInfo}
🏫 ${schoolInfo}
⏰ ${schedule.jam_mulai} - ${schedule.jam_selesai}

Jangan lupa untuk memulai absensi mengajar tepat waktu.

🔗 ${appUrl}/attendance/teaching`;

          if (schedule.whatsapp) {
            await sendWhatsAppNotification(schedule.whatsapp, waMessage);
            console.log(`[CRON] Sent start reminder to ${userName} for ${classInfo}`);
          }

          // Send in-app notification
          await sendInAppNotification(
            schedule.user_id,
            "⏰ Mengajar Akan Dimulai!",
            `${classInfo} di ${schoolInfo} akan dimulai dalam ${startDiff} menit. Jangan lupa check-in!`,
            "teaching_start_reminder",
            "teaching_schedule",
            String(schedule.schedule_id)
          );

          result.startReminders++;
        }

        // Check if we should send end reminder (30 min before)
        const endDiff = endMinutes - currentMinutes;
        if (endDiff > 0 && endDiff <= 30) {
          // Send end reminder (only once - when within 30 min window)
          const waMessage = `[GuruPRO] 🌅 Pengingat Selesai Mengajar!

Yth. *${userName}*,

⏰ Mengajar akan selesai dalam *${endDiff} menit*!

📚 ${classInfo}
🏫 ${schoolInfo}
⏰ Selesai jam ${schedule.jam_selesai}

Jangan lupa untuk menyelesaikan dan submit jurnal mengajar Anda.

🔗 ${appUrl}/attendance/teaching`;

          if (schedule.whatsapp) {
            await sendWhatsAppNotification(schedule.whatsapp, waMessage);
            console.log(`[CRON] Sent end reminder to ${userName} for ${classInfo}`);
          }

          // Send in-app notification
          await sendInAppNotification(
            schedule.user_id,
            "🌅 Selesai Mengajar!",
            `${classInfo} di ${schoolInfo} akan selesai dalam ${endDiff} menit. Segera selesaikan dan submit jurnal mengajar.`,
            "teaching_end_reminder",
            "teaching_schedule",
            String(schedule.schedule_id)
          );

          result.endReminders++;
        }

      } catch (err: any) {
        console.error(`[CRON] Error sending teaching reminder for schedule ${schedule.schedule_id}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("[CRON] Teaching reminders check failed:", err.message);
  }

  console.log(`[CRON] Teaching reminders completed: ${result.startReminders} start, ${result.endReminders} end, ${result.errors} errors`);
  return result;
}

// ==========================================
// MAIN ENTRY POINT
// ==========================================

async function main() {
  console.log("========================================");
  console.log("[CRON] Notification Reminders Job Started");
  console.log(`[CRON] Time: ${new Date().toISOString()}`);
  console.log("========================================");

  try {
    const arg = process.argv[2];

    if (!arg || arg === "all") {
      // Run all reminder types
      console.log("[CRON] Running all notification reminders...\n");

      const tokenResult = await checkAndSendTokenAlerts();
      console.log("");

      const teachingResult = await sendTeachingReminders();

      console.log("\n========================================");
      console.log("[CRON] All Reminders Completed!");
      console.log(`[CRON] Token Alerts: ${tokenResult.sent} sent`);
      console.log(`[CRON] Teaching Start: ${teachingResult.startReminders} sent`);
      console.log(`[CRON] Teaching End: ${teachingResult.endReminders} sent`);
      console.log("========================================");

    } else if (arg === "token") {
      const result = await checkAndSendTokenAlerts();
      console.log(`Token alerts: ${result.sent} sent, ${result.skipped} skipped, ${result.errors} errors`);

    } else if (arg === "teaching") {
      const result = await sendTeachingReminders();
      console.log(`Teaching reminders: ${result.startReminders} start, ${result.endReminders} end, ${result.errors} errors`);

    } else {
      console.log("Usage: npx tsx scripts/notification-reminders.ts [all|token|teaching]");
      console.log("  all       - Run all reminder types (default)");
      console.log("  token     - Run token low alert only");
      console.log("  teaching   - Run teaching reminders only");
    }

  } catch (err: any) {
    console.error("[CRON] Notification reminders job failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export for programmatic use
export { checkAndSendTokenAlerts, sendTeachingReminders };

// Run if called directly
if (require.main === module) {
  main();
}
