import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendWhatsAppNotification, sendEmailNotification } from "@/lib/notifications";
import { sendInAppNotification } from "@/lib/institution-members";
import { buildMorningBriefing, formatBriefingMessage } from "@/lib/morning-briefing";

// Sprint 2.2 — Cron BARU, terpisah dari sistem cron produksi lainnya.
// Berjalan setiap pagi (06:00–06:30), mengirim briefing ke guru yang mengaktifkan fitur.
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
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // Window 06:00–06:30
    if (currentMinutes < 360 || currentMinutes > 390) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Diluar window pagi (06:00-06:30).",
        currentTime: now.toISOString(),
      });
    }

    const todayStr = now.toISOString().split("T")[0];

    // Guru yang mengaktifkan morning briefing
    const usersRes = await query(
      `SELECT id, nama_lengkap, whatsapp, email, COALESCE(morning_briefing_enabled, true) AS enabled
       FROM users
       WHERE is_active = true
         AND COALESCE(morning_briefing_enabled, true) = true`
    );

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of usersRes.rows) {
      try {
        // Cegah duplikat kirim di hari yang sama
        const existing = await query(
          `SELECT id FROM morning_briefings WHERE teacher_id = $1 AND briefing_date = $2 LIMIT 1`,
          [user.id, todayStr]
        );
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        const briefing = await buildMorningBriefing(user.id, now);

        // Simpan hasil ke tabel morning_briefings (BARU, terpisah)
        await query(
          `INSERT INTO morning_briefings
             (teacher_id, briefing_date, jadwal, materi_tertinggal, tugas_belum_dikoreksi, siswa_perhatian, dismissed)
           VALUES ($1, $2, $3, $4, $5, $6, false)
           ON CONFLICT (teacher_id, briefing_date) DO NOTHING`,
          [
            user.id,
            todayStr,
            JSON.stringify(briefing.jadwal),
            JSON.stringify(briefing.materiTertinggal),
            briefing.tugasBelumDikoreksi,
            JSON.stringify(briefing.siswaPerhatian),
          ]
        );

        const message = formatBriefingMessage(user.nama_lengkap, briefing);

        // In-app notification
        await sendInAppNotification(
          user.id,
          "☀️ Briefing Pagi",
          `Jadwal, materi, dan hal yang perlu diperhatikan untuk hari ini sudah siap. Cek di beranda.`,
          "morning_briefing",
          "briefing",
          todayStr
        );

        // WhatsApp (reuse lib/notifications, aman simulasi jika nonaktif)
        if (user.whatsapp) {
          await sendWhatsAppNotification(user.whatsapp, message);
        }

        sent++;
      } catch (err: any) {
        console.error(`[Briefing] error untuk user ${user.id}:`, err.message);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Morning briefing selesai",
      sent,
      skipped,
      errors,
      checked: usersRes.rows.length,
      currentTime: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Morning briefing cron error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
