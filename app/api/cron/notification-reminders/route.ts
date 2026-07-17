import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendWhatsAppNotification, sendEmailNotification } from "@/lib/notifications";
import { sendInAppNotification } from "@/lib/institution-members";

// Get app URL with fallback
function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://gurupro.id";
  return appUrl.replace(/\/$/, "");
}

// ==========================================
// SUBSCRIPTION EXPIRY WARNING
// ==========================================

async function checkAndSendExpiryAlerts(): Promise<{ sent: number; skipped: number; errors: number }> {
  const result = { sent: 0, skipped: 0, errors: 0 };
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const appUrl = getAppUrl();

  // Get users whose subscription expires in 7, 3, or 1 day(s)
  try {
    const usersRes = await query(`
      SELECT
        id, email, whatsapp, nama_lengkap,
        status_langganan, subscription_end,
        last_expiry_warning_sent
      FROM users
      WHERE is_active = true
        AND status_langganan IS NOT NULL
        AND status_langganan != 'free'
        AND subscription_end IS NOT NULL
        AND subscription_status = 'active'
        AND (
          -- Expiring in 7 days
          (subscription_end::date = CURRENT_DATE + INTERVAL '7 days')
          OR
          -- Expiring in 3 days
          (subscription_end::date = CURRENT_DATE + INTERVAL '3 days')
          OR
          -- Expiring in 1 day (tomorrow)
          (subscription_end::date = CURRENT_DATE + INTERVAL '1 day')
          OR
          -- Expiring today
          (subscription_end::date = CURRENT_DATE)
        )
        AND (
          last_expiry_warning_sent IS NULL
          OR last_expiry_warning_sent::date != CURRENT_DATE
        )
    `);

    for (const user of usersRes.rows) {
      try {
        const expiryDate = new Date(user.subscription_end);
        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const userName = user.nama_lengkap || "Bapak/Ibu";

        let urgencyLevel = "info";
        let urgencyText = "";

        if (daysLeft === 0) {
          urgencyLevel = "critical";
          urgencyText = "⚠️ AKHIR HARI INI - Segera perpanjang!";
        } else if (daysLeft === 1) {
          urgencyLevel = "high";
          urgencyText = "⚠️ Besok berakhir - Segera perpanjang!";
        } else if (daysLeft <= 3) {
          urgencyLevel = "medium";
          urgencyText = `⏰ Tinggal ${daysLeft} hari lagi`;
        } else {
          urgencyText = `📅 Tinggal ${daysLeft} hari lagi`;
        }

        const waMessage = `[GuruPRO] ⏰ Pengingat Masa Aktif Akun

Yth. *${userName}*,

${urgencyText}

Masa aktif langganan GuruPRO Anda akan berakhir pada:
📅 *${expiryDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}*

Paket: *${user.status_langganan}*

Jangan sampai aktivitas mengajar Anda terganggu. Perpanjang sekarang:
🔗 ${appUrl}/dashboard/billing

---
Pesan otomatis dari Sistem GuruPRO`;

        const emailSubject = daysLeft === 0
          ? "URGEN: Masa Aktif GuruPRO Berakhir Hari Ini!"
          : `Pengingat: Masa Aktif GuruPRO Akan Berakhir dalam ${daysLeft} Hari`;

        const emailHtml = `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: ${daysLeft <= 1 ? '#ef4444' : '#f59e0b'};">⏰ Pengingat Masa Aktif Akun</h2>
            <p>Halo <strong>${userName}</strong>,</p>
            <p>${urgencyText}</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>📅 Tanggal Berakhir:</strong> ${expiryDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin: 5px 0;"><strong>📦 Paket:</strong> ${user.status_langganan}</p>
              <p style="margin: 5px 0;"><strong>⏱️ Sisa Hari:</strong> ${daysLeft <= 0 ? 'Hari ini!' : `${daysLeft} hari`}</p>
            </div>
            <p>Jangan sampai aktivitas mengajar Anda terganggu. Perpanjang sekarang:</p>
            <a href="${appUrl}/dashboard/billing" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 10px 0;">
              Perpanjang Sekarang
            </a>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">Pesan otomatis dari Sistem GuruPRO</p>
          </div>
        `;

        // Send WhatsApp
        if (user.whatsapp) {
          await sendWhatsAppNotification(user.whatsapp, waMessage);
        }

        // Send Email
        if (user.email) {
          await sendEmailNotification(user.email, emailSubject, emailHtml);
        }

        // Send In-App Notification
        await sendInAppNotification(
          user.id,
          daysLeft === 0 ? "⚠️ Masa Aktif Berakhir Hari Ini!" : `⏰ Masa Aktif Akan Berakhir dalam ${daysLeft} Hari`,
          `Masa aktif langganan Anda akan berakhir pada ${expiryDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}. Segera perpanjang di menu Billing.`,
          urgencyLevel === "critical" ? "subscription_expiry_critical" : "subscription_expiry_warning",
          "subscription",
          null
        );

        // Update last_expiry_warning_sent
        await query(
          "UPDATE users SET last_expiry_warning_sent = $1 WHERE id = $2",
          [today, user.id]
        );

        result.sent++;
      } catch (err: any) {
        console.error(`Error sending expiry warning to user ${user.id}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("Expiry alert check failed:", err.message);
  }

  return result;
}

// ==========================================
// GRACE PERIOD WARNING
// ==========================================

async function checkAndSendGracePeriodAlerts(): Promise<{ sent: number; skipped: number; errors: number }> {
  const result = { sent: 0, skipped: 0, errors: 0 };
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const appUrl = getAppUrl();

  try {
    const usersRes = await query(`
      SELECT
        id, email, whatsapp, nama_lengkap,
        status_langganan, subscription_end, grace_period_ends_at,
        last_expiry_warning_sent
      FROM users
      WHERE is_active = true
        AND subscription_status = 'grace_period'
        AND grace_period_ends_at IS NOT NULL
        AND (
          -- Grace period ends in 3 days
          (grace_period_ends_at::date = CURRENT_DATE + INTERVAL '3 days')
          OR
          -- Grace period ends in 1 day
          (grace_period_ends_at::date = CURRENT_DATE + INTERVAL '1 day')
          OR
          -- Grace period ends tomorrow
          (grace_period_ends_at::date = CURRENT_DATE)
        )
        AND (
          last_expiry_warning_sent IS NULL
          OR last_expiry_warning_sent::date != CURRENT_DATE
        )
    `);

    for (const user of usersRes.rows) {
      try {
        const graceEndDate = new Date(user.grace_period_ends_at);
        const daysLeft = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const userName = user.nama_lengkap || "Bapak/Ibu";

        const waMessage = `[GuruPRO] 🚨 MASA TENGANG AKHIR - Segera Perpanjang!

Yth. *${userName}*,

⚠️ MASA TENGANG AKUN ANDA AKAN BERAKHIR!

Masa tenggang setelah langganan berakhir akan selesai pada:
📅 *${graceEndDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}*

Jika tidak diperpanjang, akun Anda akan dinonaktifkan dan Anda kehilangan akses ke semua fitur premium.

🔗 ${appUrl}/dashboard/billing

---
Pesan otomatis dari Sistem GuruPRO`;

        const emailSubject = "URGEN: Masa Tenggang GuruPRO Akan Berakhir!";
        const emailHtml = `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #dc2626;">🚨 Masa Tenggang Akan Berakhir!</h2>
            <p>Halo <strong>${userName}</strong>,</p>
            <p>⚠️ <strong>Masa tenggang akun Anda akan berakhir!</strong></p>
            <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #fecaca;">
              <p style="margin: 5px 0;"><strong>📅 Masa Tenggang Berakhir:</strong></p>
              <p style="font-size: 18px; margin: 10px 0;">${graceEndDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin: 5px 0;"><strong>⏱️ Sisa Hari:</strong> ${daysLeft <= 0 ? 'Hari ini!' : `${daysLeft} hari`}</p>
            </div>
            <p>Jika tidak diperpanjang, akun Anda akan <strong>dinonaktifkan</strong>!</p>
            <a href="${appUrl}/dashboard/billing" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 8px; margin: 10px 0;">
              Perpanjang Sekarang - SELESAIKAN!
            </a>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">Pesan otomatis dari Sistem GuruPRO</p>
          </div>
        `;

        if (user.whatsapp) {
          await sendWhatsAppNotification(user.whatsapp, waMessage);
        }

        if (user.email) {
          await sendEmailNotification(user.email, emailSubject, emailHtml);
        }

        await sendInAppNotification(
          user.id,
          "🚨 Masa Tenggang Akan Berakhir!",
          `Masa tenggang Anda akan berakhir pada ${graceEndDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}. Segera perpanjang atau akun akan dinonaktifkan!`,
          "grace_period_critical",
          "subscription",
          null
        );

        await query(
          "UPDATE users SET last_expiry_warning_sent = $1 WHERE id = $2",
          [today, user.id]
        );

        result.sent++;
      } catch (err: any) {
        console.error(`Error sending grace period warning to user ${user.id}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("Grace period alert check failed:", err.message);
  }

  return result;
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
    let expiryResult = { sent: 0, skipped: 0, errors: 0 };
    let graceResult = { sent: 0, skipped: 0, errors: 0 };

    if (type === "all" || type === "token") {
      tokenResult = await checkAndSendTokenAlerts();
    }

    if (type === "all" || type === "teaching") {
      teachingResult = await sendTeachingReminders();
    }

    if (type === "all" || type === "subscription") {
      expiryResult = await checkAndSendExpiryAlerts();
      graceResult = await checkAndSendGracePeriodAlerts();
    }

    return NextResponse.json({
      success: true,
      message: "Notification reminders completed",
      results: {
        tokenAlerts: tokenResult,
        teachingReminders: teachingResult,
        subscriptionExpiry: expiryResult,
        gracePeriod: graceResult,
      },
      currentTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Notification reminders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
