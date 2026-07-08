import { getPayload } from "../lib/payload";
import { COLLECTIONS } from "../collections/config";
import { generateShareToken, generateShareMessage, generateWaMeLink, getShareLinkExpiryDate } from "../lib/performance-share";
import { sendWhatsAppNotification, sendEmailNotification } from "../lib/notifications";
import { SHARE_LINK_DEFAULT_EXPIRY_DAYS } from "../collections/config";
import { query } from "../lib/db";

const FREQUENCY_MAP: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

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

export async function runScheduledNotifications() {
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
      const frequency = (contact as any).notificationFrequency as keyof typeof FREQUENCY_MAP;
      const lastNotified = (contact as any).lastNotifiedAt;

      let shouldSend = false;

      if (!lastNotified) {
        shouldSend = true;
      } else {
        const lastDate = new Date(lastNotified);
        const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLast >= FREQUENCY_MAP[frequency]) {
          shouldSend = true;
        }
      }

      if (!shouldSend) {
        skipped++;
        continue;
      }

      const teacherId = (contact as any).teacherId;
      if (!teacherId) {
        skipped++;
        continue;
      }

      const stats = await getAggregatedStatsForTeacher(teacherId);

      const shareToken = generateShareToken();
      const expiresAt = getShareLinkExpiryDate(SHARE_LINK_DEFAULT_EXPIRY_DAYS);

      await payload.create({
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
        await sendWhatsAppNotification((contact as any).phoneNumber, shareMessage);
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
              Frekuensi pengiriman: ${frequency === "daily" ? "Harian" : frequency === "weekly" ? "Mingguan" : "Bulanan"}
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

  return { sent, skipped, errors, checked: contacts.docs.length };
}
