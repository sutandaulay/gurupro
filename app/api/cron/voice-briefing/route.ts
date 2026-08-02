import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getGreetingByTime, composeBriefingText } from "@/lib/voice-briefing";

async function getVoiceBriefingSubscribers() {
  const res = await query(
    `SELECT np.user_id, u.nama_lengkap, u.gender, ps.subscription, ps.user_agent
     FROM notification_preferences np
     JOIN users u ON u.id = np.user_id
     LEFT JOIN push_subscriptions ps ON ps.user_id = np.user_id
     WHERE np.voice_briefing_enabled = true
       AND u.is_active = true`
  );
  return res.rows;
}

async function getTodaySchedulesForUser(userId: string, hari: string) {
  const res = await query(
    `SELECT sc.id, sc.hari, sc.jam_mulai, sc.jam_selesai, sc.start_time, sc.end_time,
            c.nama_kelas, sb.nama_mapel
     FROM schedules sc
     JOIN classes c ON sc.class_id = c.id
     JOIN subjects sb ON sc.subject_id = sb.id
     WHERE sc.hari = $1
       AND sc.school_id IN (
         SELECT "schoolId" FROM user_school_assignments WHERE "userId" = $2
       )
     ORDER BY sc.jam_mulai ASC`,
    [hari, userId]
  );
  return res.rows;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const todayHari = hariIndo[now.getDay()];

    const subscribers = await getVoiceBriefingSubscribers();
    let pushSent = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of subscribers) {
      try {
        const schedules = await getTodaySchedulesForUser(user.user_id, todayHari);
        if (schedules.length === 0) {
          skipped++;
          continue;
        }

        const matched = schedules.find((sched: any) => {
          const startSource = sched.start_time || sched.jam_mulai;
          if (!startSource) return false;
          const [h, m] = String(startSource).split(":").map(Number);
          const scheduleStart = new Date(now);
          scheduleStart.setHours(h, m, 0, 0);
          const diffMin = (scheduleStart.getTime() - now.getTime()) / 60000;
          return diffMin > 9 && diffMin <= 10;
        });

        if (!matched) {
          skipped++;
          continue;
        }

        const startSource = matched.start_time || matched.jam_mulai;
        const endSource = matched.end_time || matched.jam_selesai;

        const message = composeBriefingText({
          gender: user.gender,
          fullName: user.nama_lengkap,
          className: matched.nama_kelas,
          subjectName: matched.nama_mapel,
          startTime: String(startSource).slice(0, 5),
          endTime: String(endSource).slice(0, 5),
        });

        // Idempotency: check if already logged (skip if push was already sent today for this schedule)
        const alreadySent = await query(
          `SELECT 1 FROM voice_briefing_logs WHERE user_id = $1 AND schedule_id = $2`,
          [user.user_id, matched.id]
        );
        if (alreadySent.rows.length > 0) {
          skipped++;
          continue;
        }

        if (user.subscription && user.subscription.endpoint) {
          try {
            await sendPushNotification(user.subscription, {
              title: "🔔 10 Menit lagi - Mulai Mengajar",
              body: message,
              data: {
                scheduleId: matched.id,
                userId: user.user_id,
              },
            });
            // Log AFTER successful push
            await query(
              `INSERT INTO voice_briefing_logs (user_id, schedule_id) VALUES ($1, $2)`,
              [user.user_id, matched.id]
            );
            pushSent++;
          } catch (pushErr: any) {
            console.error(`[VoiceBriefing] Push failed for ${user.user_id}:`, pushErr.message);
            await query(
              `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
              [user.user_id, user.subscription.endpoint]
            );
          }
        }
      } catch (err: any) {
        console.error(`[VoiceBriefing] Error for user ${user.user_id}:`, err.message);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      pushSent,
      skipped,
      errors,
      checked: subscribers.length,
      currentTime: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Voice briefing cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function sendPushNotification(subscription: any, payload: { title: string; body: string; data?: any }) {
  const webpush = await import("web-push");
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@gurupro.id";

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("VAPID keys not configured");
  }

  webpush.default.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  await webpush.default.sendNotification(
    subscription,
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "voice-briefing",
      requireInteraction: false,
      silent: false,
    })
  );
}
