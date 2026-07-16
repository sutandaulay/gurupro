import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { sendInAppNotification } from "@/lib/institution-members";

// Get app URL with fallback
function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://gurupro.id";
  return appUrl.replace(/\/$/, "");
}

// ==========================================
// TOKEN LOW ALERT
// ==========================================

async function checkAndSendTokenAlerts(): Promise<{ sent: number; skipped: number; errors: number }> {
  const result = { sent: 0, skipped: 0, errors: 0 };
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const appUrl = getAppUrl();

  try {
    const usersRes = await query(`
      SELECT
        id, email, whatsapp, nama_lengkap,
        COALESCE(token_limit, 0) as token_limit,
        COALESCE(addon_token_balance, 0) as addon_token_balance,
        status_langganan, last_token_warning_sent
      FROM users
      WHERE is_active = true
        AND (status_langganan IS NOT NULL AND status_langganan != 'free')
        AND (token_limit <= 10 OR (token_limit <= 5 AND addon_token_balance <= 0))
        AND (
          last_token_warning_sent IS NULL
          OR last_token_warning_sent != $1
        )
    `, [today]);

    for (const user of usersRes.rows) {
      try {
        const totalTokens = Number(user.token_limit) + Number(user.addon_token_balance);
        const userName = user.nama_lengkap || "Guru";
        const isCritical = totalTokens <= 5;

        const waMessage = `[GuruPRO] ⚠️ Peringatan Token Hampir Habis!

Yth. *${userName}*,

Kuota token AI Anda hampir habis! Sisa token Anda saat ini: *${totalTokens} token*.

${isCritical ? '⚠️ KUOTA SANGAT TERBATAS - Segera lakukan top-up!' : ''}

Jangan sampai aktivitas mengajar terganggu. Top-up sekarang di:
${appUrl}/dashboard/billing

---
Pesan otomatis dari Sistem GuruPRO`;

        if (user.whatsapp) {
          await sendWhatsAppNotification(user.whatsapp, waMessage);
        }

        await sendInAppNotification(
          user.id,
          isCritical ? "⚠️ Kuota Token Sangat Terbatas!" : "⚠️ Kuota Token Menipis",
          `Sisa token Anda: ${totalTokens}. ${isCritical ? 'Segera top-up untuk melanjutkan aktivitas.' : 'Pertimbangkan untuk top-up.'}`,
          isCritical ? "token_critical" : "token_low",
          "token_balance",
          null
        );

        await query(
          "UPDATE users SET last_token_warning_sent = $1 WHERE id = $2",
          [today, user.id]
        );

        result.sent++;
      } catch (err: any) {
        console.error(`Error sending token warning to user ${user.id}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("Token alert check failed:", err.message);
  }

  return result;
}

// ==========================================
// TEACHING REMINDERS
// ==========================================

async function sendTeachingReminders(): Promise<{ startReminders: number; endReminders: number; errors: number }> {
  const result = { startReminders: 0, endReminders: 0, errors: 0 };
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const appUrl = getAppUrl();

  try {
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
        ts.jam_selesai
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

    for (const schedule of schedulesRes.rows) {
      try {
        const [startHour, startMin] = String(schedule.jam_mulai).split(':').map(Number);
        const [endHour, endMin] = String(schedule.jam_selesai).split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        const userName = schedule.user_name || "Guru";
        const classInfo = `${schedule.class_name} - ${schedule.mapel_name}`;
        const schoolInfo = schedule.school_name;

        // Start reminder: 15 minutes before
        const startDiff = startMinutes - currentMinutes;
        if (startDiff > 0 && startDiff <= 15) {
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
          }

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

        // End reminder: 30 minutes before
        const endDiff = endMinutes - currentMinutes;
        if (endDiff > 0 && endDiff <= 30) {
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
          }

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
        console.error(`Error sending teaching reminder for schedule ${schedule.schedule_id}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("Teaching reminders check failed:", err.message);
  }

  return result;
}

// ==========================================
// API ROUTE
// ==========================================

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured on server" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";

    console.log(`[CRON] Notification Reminders - Type: ${type}`);
    console.log(`[CRON] Time: ${new Date().toISOString()}`);

    let tokenResult = { sent: 0, skipped: 0, errors: 0 };
    let teachingResult = { startReminders: 0, endReminders: 0, errors: 0 };

    if (type === "all" || type === "token") {
      tokenResult = await checkAndSendTokenAlerts();
    }

    if (type === "all" || type === "teaching") {
      teachingResult = await sendTeachingReminders();
    }

    return NextResponse.json({
      success: true,
      message: "Notification reminders completed",
      results: {
        tokenAlerts: tokenResult,
        teachingReminders: teachingResult,
      },
      currentTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Notification reminders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
