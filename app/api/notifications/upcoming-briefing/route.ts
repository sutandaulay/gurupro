import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getGreetingByTime, composeBriefingText } from "@/lib/voice-briefing";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.id;

    const prefsRes = await query(
      `SELECT voice_briefing_enabled, voice_name_preference
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const prefs = prefsRes.rows[0];
    if (!prefs || prefs.voice_briefing_enabled !== true) {
      return NextResponse.json({
        shouldNotify: false,
        message: "",
        scheduleId: null,
      });
    }

    const now = new Date();
    const hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const todayHari = hariIndo[now.getDay()];

    const schedulesRes = await query(
      `SELECT 
         sc.id, sc.hari, sc.jam_mulai, sc.jam_selesai, sc.start_time, sc.end_time,
         c.nama_kelas, sb.nama_mapel,
         u.nama_lengkap, u.gender
       FROM schedules sc
       JOIN classes c ON sc.class_id = c.id
       JOIN subjects sb ON sc.subject_id = sb.id
       JOIN users u ON u.id = $1
       WHERE sc.hari = $2
         AND sc.school_id IN (
           SELECT "schoolId" FROM user_school_assignments WHERE "userId" = $1
         )
       ORDER BY sc.jam_mulai ASC`,
      [userId, todayHari]
    );

    const matched = schedulesRes.rows.find((row: any) => {
      const startSource = row.start_time || row.jam_mulai;
      if (!startSource) return false;

      const [h, m] = String(startSource).split(":").map(Number);
      const scheduleStart = new Date(now);
      scheduleStart.setHours(h, m, 0, 0);

      const diffMs = scheduleStart.getTime() - now.getTime();
      const diffMin = diffMs / 60000;

      return diffMin > 9 && diffMin <= 10;
    });

    if (!matched) {
      return NextResponse.json({
        shouldNotify: false,
        message: "",
        scheduleId: null,
      });
    }

    const startSource = matched.start_time || matched.jam_mulai;
    const endSource = matched.end_time || matched.jam_selesai;

    const message = composeBriefingText({
      gender: matched.gender,
      fullName: matched.nama_lengkap,
      className: matched.nama_kelas,
      subjectName: matched.nama_mapel,
      startTime: String(startSource).slice(0, 5),
      endTime: String(endSource).slice(0, 5),
    });

    return NextResponse.json({
      shouldNotify: true,
      message,
      scheduleId: matched.id,
    });
  } catch (error: any) {
    console.error("Upcoming briefing error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
