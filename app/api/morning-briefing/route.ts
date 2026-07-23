import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

// Endpoint card Morning Briefing di dashboard guru.
// GET: ambil briefing hari ini (atau generate on-the-fly jika cron belum jalan).
// POST: set dismissed = true (atau toggle preferensi on/off).

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const teacherId = session.id;
    const todayStr = new Date().toISOString().split("T")[0];

    // Cek preferensi on/off
    const prefRes = await query(
      `SELECT COALESCE(morning_briefing_enabled, true) AS enabled FROM users WHERE id = $1`,
      [teacherId]
    );
    const enabled = prefRes.rows[0]?.enabled ?? true;

    if (!enabled) {
      return NextResponse.json({ enabled: false, briefing: null });
    }

    // Ambil briefing hari ini jika sudah dibuat cron
    const res = await query(
      `SELECT jadwal, materi_tertinggal, tugas_belum_dikoreksi, siswa_perhatian, dismissed
       FROM morning_briefings WHERE teacher_id = $1 AND briefing_date = $2 LIMIT 1`,
      [teacherId, todayStr]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return NextResponse.json({
        enabled: true,
        dismissed: row.dismissed,
        briefing: {
          jadwal: row.jadwal,
          materiTertinggal: row.materi_tertinggal,
          tugasBelumDikoreksi: Number(row.tugas_belum_dikoreksi) || 0,
          siswaPerhatian: row.siswa_perhatian,
        },
      });
    }

    // Fallback: cron mungkin belum jalan, generate on-the-fly (read-only)
    const { buildMorningBriefing } = await import("@/lib/morning-briefing");
    const briefing = await buildMorningBriefing(teacherId, new Date());
    return NextResponse.json({ enabled: true, dismissed: false, briefing });
  } catch (error: any) {
    console.error("Error fetching morning briefing:", error);
    return NextResponse.json({ error: error?.message || "Gagal memuat briefing." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const teacherId = session.id;
    const body = await req.json().catch(() => ({}));
    const todayStr = new Date().toISOString().split("T")[0];

    if (body.action === "toggle_preference") {
      const enabled = body.enabled === true;
      await query(`UPDATE users SET morning_briefing_enabled = $1 WHERE id = $2`, [enabled, teacherId]);
      return NextResponse.json({ success: true, enabled });
    }

    if (body.action === "dismiss") {
      // Upsert agar dismiss tersimpan meskipun cron belum kebuat row hari ini
      await query(
        `INSERT INTO morning_briefings (teacher_id, briefing_date, dismissed)
         VALUES ($1, $2, true)
         ON CONFLICT (teacher_id, briefing_date) DO UPDATE SET dismissed = true`,
        [teacherId, todayStr]
      );
      return NextResponse.json({ success: true, dismissed: true });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error: any) {
    console.error("Error updating morning briefing:", error);
    return NextResponse.json({ error: error?.message || "Gagal membarui briefing." }, { status: 500 });
  }
}
