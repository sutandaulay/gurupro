import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { sendInAppNotification } from "@/lib/institution-members";
import { buildWeeklyRecap, formatRecapMessage } from "@/lib/weekly-recap";

// Sprint 2.1 — Cron BARU, terpisah dari sistem cron produksi lainnya.
// Berjalan tiap Minggu malam, mengirim recap mingguan ke GURU (bukan leader).
// Semua data diambil READ-ONLY. Tidak mengubah tabel sumber manapun.

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured on server" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Hanya kirim tiap hari Minggu (getDay() === 0)
    if (now.getDay() !== 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Bukan hari Minggu, recap dilewati.",
        currentTime: now.toISOString(),
      });
    }

    // Window malam: 19:00–21:00
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (currentMinutes < 1140 || currentMinutes > 1260) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Diluar window malam Minggu (19:00-21:00).",
        currentTime: now.toISOString(),
      });
    }

    // Guru yang mengaktifkan weekly recap
    const usersRes = await query(
      `SELECT id, nama_lengkap, whatsapp, COALESCE(weekly_recap_enabled, true) AS enabled
       FROM users
       WHERE is_active = true
         AND COALESCE(weekly_recap_enabled, true) = true`
    );

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of usersRes.rows) {
      try {
        const recap = await buildWeeklyRecap(user.id, now);

        // Cegah duplikat: unique (teacher_id, week_start)
        const existing = await query(
          `SELECT id FROM weekly_recaps WHERE teacher_id = $1 AND week_start = $2 LIMIT 1`,
          [user.id, recap.weekStart]
        );
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        await query(
          `INSERT INTO weekly_recaps
             (teacher_id, week_start, week_end, sesi_mengajar, siswa_remedial_selesai, progress_kurikulum, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (teacher_id, week_start) DO NOTHING`,
          [
            user.id,
            recap.weekStart,
            recap.weekEnd,
            recap.sesiMengajar,
            recap.siswaRemedialSelesai,
            JSON.stringify(recap.progressKurikulum),
          ]
        );

        const message = formatRecapMessage(user.nama_lengkap, recap);

        await sendInAppNotification(
          user.id,
          "🌟 Rekap Mingguan",
          `Minggu ini: ${recap.sesiMengajar} sesi mengajar, ${recap.siswaRemedialSelesai} siswa selesai remedial. Kerja keras Anda luar biasa!`,
          "weekly_recap",
          "recap",
          recap.weekStart
        );

        if (user.whatsapp) {
          await sendWhatsAppNotification(user.whatsapp, message);
        }

        sent++;
      } catch (err: any) {
        console.error(`[Recap] error untuk user ${user.id}:`, err.message);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Weekly recap selesai",
      sent,
      skipped,
      errors,
      checked: usersRes.rows.length,
      currentTime: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Weekly recap cron error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
