import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS } from "@/collections/config";
import { generateShareToken, generateShareMessage, generateWaMeLink, getShareLinkExpiryDate } from "@/lib/performance-share";
import { sendWhatsAppNotification, sendEmailNotification } from "@/lib/notifications";
import { SHARE_LINK_DEFAULT_EXPIRY_DAYS } from "@/collections/config";
import { query } from "@/lib/db";

// Helper function to parse time string "HH:MM" to minutes since midnight
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length !== 2) return -1;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
}

// Check if current time is within the notification window (within 5 minutes of scheduled time)
function isNotificationTime(now: Date, scheduledTime: string): boolean {
  const scheduledMinutes = parseTimeToMinutes(scheduledTime);
  if (scheduledMinutes === -1) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Allow a 5-minute window before and after the scheduled time
  const diff = Math.abs(currentMinutes - scheduledMinutes);
  return diff <= 5;
}

// Check if today matches the scheduled day for weekly notifications
function isScheduledDay(now: Date, scheduledDay: string): boolean {
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  // Our scheduledDay uses 1 for Monday, 2 for Tuesday, etc.
  const currentDay = now.getDay();
  const targetDay = parseInt(scheduledDay, 10);

  // Convert: our 1-6 (Mon-Sat) maps to getDay() 1-6
  return currentDay === targetDay;
}

// Check if today matches the scheduled date for monthly notifications
function isScheduledDate(now: Date, scheduledDate: string): boolean {
  const currentDate = now.getDate();
  const targetDate = parseInt(scheduledDate, 10);
  return currentDate === targetDate;
}

// Check if it's time to send based on frequency and scheduling
function shouldSendNow(
  now: Date,
  frequency: string,
  notificationTime: string,
  notificationDay: string,
  notificationDate: string,
  lastNotifiedAt: Date | null
): boolean {
  switch (frequency) {
    case "daily":
      // For daily: check if it's the scheduled time
      return isNotificationTime(now, notificationTime || "14:00");

    case "weekly":
      // For weekly: check if it's the scheduled day AND time
      const targetDay = notificationDay || "5";
      if (!isScheduledDay(now, targetDay)) return false;
      return isNotificationTime(now, notificationTime || "14:00");

    case "monthly":
      // For monthly: check if it's the scheduled date AND time
      const targetDate = notificationDate || "25";
      if (!isScheduledDate(now, targetDate)) return false;
      return isNotificationTime(now, notificationTime || "10:00");

    default:
      return false;
  }
}

// Get human-readable frequency label
function getFrequencyLabel(
  frequency: string,
  notificationTime: string,
  notificationDay: string,
  notificationDate: string
): string {
  const dayNames: Record<string, string> = {
    "1": "Senin", "2": "Selasa", "3": "Rabu", "4": "Kamis", "5": "Jumat", "6": "Sabtu"
  };

  switch (frequency) {
    case "daily":
      return `Harian pada jam ${notificationTime || "14:00"}`;
    case "weekly":
      return `Mingguan setiap ${dayNames[notificationDay || "5"]} jam ${notificationTime || "14:00"}`;
    case "monthly":
      return `Bulanan setiap tanggal ${notificationDate || "25"} jam ${notificationTime || "10:00"}`;
    default:
      return "Manual";
  }
}

async function getAggregatedStatsForTeacher(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const today = now.toISOString().split('T')[0];
  const startStr = startOfMonth.toISOString().split('T')[0];
  const endStr = endOfMonth.toISOString().split('T')[0];

  const schoolResult = await query(`
    SELECT school_id FROM user_schools WHERE user_id = $1 LIMIT 1
  `, [userId]);

  const schoolId = schoolResult.rows[0]?.school_id || null;

  let journalData = { total_journals: 0, completed_count: 0, missing_count: 0 };
  let rppData = { total_rpp: 0 };
  let lkpdData = { total_lkpd: 0 };
  let bankSoalData = { total_soal: 0 };

  if (schoolId) {
    try {
      const journalStats = await query(`
        SELECT
          COUNT(*)::integer as total_journals,
          COUNT(CASE WHEN tanggal <= $3 THEN 1 END)::integer as completed_count,
          COUNT(CASE WHEN tanggal < $3 AND (catatan IS NULL OR catatan = '') THEN 1 END)::integer as missing_count
        FROM teacher_journals
        WHERE teacher_id = $1 AND school_id = $2
          AND tanggal >= $4 AND tanggal <= $5
      `, [userId, schoolId, today, startStr, endStr]);
      if (journalStats.rows[0]) journalData = journalStats.rows[0];
    } catch (e) {}

    try {
      const rppStats = await query(`
        SELECT COUNT(*)::integer as total_rpp FROM modul_ajar
        WHERE user_id = $1 AND (school_id = $2 OR school_id IS NULL)
      `, [userId, schoolId]);
      if (rppStats.rows[0]) rppData = rppStats.rows[0];
    } catch (e) {}

    try {
      const lkpdStats = await query(`
        SELECT COUNT(*)::integer as total_lkpd FROM lkpd
        WHERE user_id = $1 AND (school_id = $2 OR school_id IS NULL)
      `, [userId, schoolId]);
      if (lkpdStats.rows[0]) lkpdData = lkpdStats.rows[0];
    } catch (e) {}

    try {
      const bankSoalStats = await query(`
        SELECT COUNT(*)::integer as total_soal FROM bank_soal
        WHERE user_id = $1 AND (school_id = $2 OR school_id IS NULL)
      `, [userId, schoolId]);
      if (bankSoalStats.rows[0]) bankSoalData = bankSoalStats.rows[0];
    } catch (e) {}
  }

  const totalJurnal = Number(journalData.total_journals) || 0;
  const totalRpp = Number(rppData.total_rpp) || 0;
  const totalLkpd = Number(lkpdData.total_lkpd) || 0;
  const totalBankSoal = Number(bankSoalData.total_soal) || 0;
  const completedJurnal = Number(journalData.completed_count) || 0;
  const missingJurnal = Number(journalData.missing_count) || 0;

  return {
    period: `${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
    totalActivities: totalJurnal + totalRpp + totalLkpd + totalBankSoal,
    completedActivities: completedJurnal + Math.min(totalRpp, 5) + Math.min(totalLkpd, 3) + Math.min(totalBankSoal, 2),
    onTimeCount: completedJurnal,
    lateCount: 0,
    missingCount: missingJurnal,
    rppCompletionRate: totalRpp > 0 ? Math.min(100, Math.round((totalRpp / 10) * 100)) : 0,
    jurnalCompletionRate: totalJurnal > 0 ? Math.round((completedJurnal / totalJurnal) * 100) : 0,
    bankSoalCompletionRate: totalBankSoal > 0 ? Math.min(100, Math.round((totalBankSoal / 5) * 100)) : 0,
    lkpdCompletionRate: totalLkpd > 0 ? Math.min(100, Math.round((totalLkpd / 5) * 100)) : 0,
    totalRpp,
    totalJurnal,
    totalBankSoal,
    totalLkpd,
    lastActivityDate: now.toISOString(),
  };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "dev-cron-secret";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getPayload();
    const now = new Date();
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    const contacts = await payload.find({
      collection: COLLECTIONS.LEADER_CONTACTS,
      where: {
        optedOut: { not_equals: true },
        notificationFrequency: { not_in: ["", "manual"] },
      },
      limit: 100,
    });

    for (const contact of contacts.docs) {
      try {
        const frequency = (contact as any).notificationFrequency as string;
        const notificationTime = (contact as any).notificationTime as string || "14:00";
        const notificationDay = (contact as any).notificationDay as string || "5";
        const notificationDate = (contact as any).notificationDate as string || "25";
        const lastNotifiedAt = (contact as any).lastNotifiedAt
          ? new Date((contact as any).lastNotifiedAt)
          : null;

        // Check if it's time to send based on frequency and scheduling
        if (!shouldSendNow(now, frequency, notificationTime, notificationDay, notificationDate, lastNotifiedAt)) {
          skipped++;
          continue;
        }

        // Prevent duplicate sends on the same day
        if (lastNotifiedAt) {
          const lastDate = lastNotifiedAt.toISOString().split('T')[0];
          const today = now.toISOString().split('T')[0];
          if (lastDate === today) {
            skipped++;
            continue;
          }
        }

        const teacherId = (contact as any).teacherId;
        if (!teacherId) {
          skipped++;
          continue;
        }

        const stats = await getAggregatedStatsForTeacher(teacherId);

        const shareToken = generateShareToken();
        const expiresAt = getShareLinkExpiryDate(SHARE_LINK_DEFAULT_EXPIRY_DAYS);

        const newShareLink = await payload.create({
          collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
          data: {
            teacherId,
            leaderContactId: contact.id,
            shareToken,
            accessLevel: "level1_summary_only",
            aggregatedStats: stats,
            expiresAt,
            viewCount: 0,
          },
        });

        await payload.update({
          collection: COLLECTIONS.LEADER_CONTACTS,
          id: contact.id,
          data: {
            lastNotifiedAt: now,
          },
        });

        const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/leader-view/${shareToken}`;
        const leaderName = (contact as any).leaderName || "Pimpinan";
        const shareMessage = generateShareMessage(leaderName, "Guru", shareUrl);

        if ((contact as any).phoneNumber) {
          const waMeLink = generateWaMeLink((contact as any).phoneNumber, shareMessage);
          if (waMeLink) {
            await sendWhatsAppNotification((contact as any).phoneNumber, shareMessage);
          }
        }

        if ((contact as any).email) {
          const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #4f46e5;">Laporan Kinerja GuruPRO AI</h2>
              <p>Yth. ${leaderName},</p>
              <p>Guru telah membagikan laporan kinerja terbaru. Klik tautan berikut untuk melihat:</p>
              <a href="${shareUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
                Lihat Laporan
              </a>
              <p style="color: #666; font-size: 14px;">
                Frekuensi: ${getFrequencyLabel(frequency, notificationTime, notificationDay, notificationDate)}
              </p>
            </div>
          `;
          await sendEmailNotification(
            (contact as any).email,
            `Laporan Kinerja Guru - ${now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
            emailHtml
          );
        }

        sent++;
      } catch (err: any) {
        console.error(`Error sending to contact ${contact.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scheduled notifications completed`,
      sent,
      skipped,
      errors,
      checked: contacts.docs.length,
      currentTime: now.toISOString(),
      currentTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      details: {
        daily: contacts.docs.filter(c => (c as any).notificationFrequency === "daily").length,
        weekly: contacts.docs.filter(c => (c as any).notificationFrequency === "weekly").length,
        monthly: contacts.docs.filter(c => (c as any).notificationFrequency === "monthly").length,
      },
    });
  } catch (error: any) {
    console.error("Scheduled notifications error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
