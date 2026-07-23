import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  attendanceSummary,
  institutions as institutionsTable,
  teacherInstitutionAssignments,
} from "@/lib/schemas/attendance";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { query as pgQuery } from "@/lib/db";

// Sprint 3.2 — Endpoint BARU untuk agregasi TPG lintas institusi.
// REUSE query dari /api/attendance/tpg-reports (READ-ONLY ke attendance_summary).
// Tidak mengubah endpoint tpg-reports yang sudah produksi.
// Hasil di-cache 1 jam di tabel tpg_cross_institution_cache untuk jaga performa.

const TPGCrossQuerySchema = z.object({
  periodType: z.enum(["weekly", "monthly"]).optional().default("weekly"),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

async function computeCrossInstitution(
  teacherId: string,
  startDate: Date,
  endDate: Date,
  periodType: string
) {
  // Guru mengajar di banyak institusi
  const assignments = await db
    .select({ institutionId: teacherInstitutionAssignments.institutionId })
    .from(teacherInstitutionAssignments)
    .where(
      and(
        eq(teacherInstitutionAssignments.teacherId, teacherId),
        eq(teacherInstitutionAssignments.status, "aktif")
      )
    );

  if (assignments.length === 0) {
    return {
      teacherId,
      institutions: [],
      total: { minutes: 0, sessions: 0, attendanceDays: 0, lateDays: 0 },
      isRequirementMet: false,
      weeklyDeficit: 1440,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
    };
  }

  const instIds = assignments.map((a) => a.institutionId);

  const attendanceData = await db
    .select({
      institutionId: attendanceSummary.institutionId,
      attendanceStatus: attendanceSummary.attendanceStatus,
      teachingMinutesTotal: attendanceSummary.teachingMinutesTotal,
      teachingSessionsCompleted: attendanceSummary.teachingSessionsCompleted,
    })
    .from(attendanceSummary)
    .where(
      and(
        eq(attendanceSummary.teacherId, teacherId),
        inArray(attendanceSummary.institutionId, instIds),
        gte(attendanceSummary.date, startDate),
        lte(attendanceSummary.date, endDate)
      )
    );

  const institutions = await db
    .select({ id: institutionsTable.id, name: institutionsTable.name })
    .from(institutionsTable)
    .where(inArray(institutionsTable.id, instIds));
  const instMap: Record<number, string> = {};
  institutions.forEach((i) => { instMap[i.id] = i.name; });

  const stats: Record<number, { minutes: number; sessions: number; attendanceDays: number; lateDays: number }> = {};
  instIds.forEach((id) => { stats[id] = { minutes: 0, sessions: 0, attendanceDays: 0, lateDays: 0 }; });

  attendanceData.forEach((r) => {
    const s = stats[r.institutionId] || (stats[r.institutionId] = { minutes: 0, sessions: 0, attendanceDays: 0, lateDays: 0 });
    s.minutes += Number(r.teachingMinutesTotal);
    s.sessions += Number(r.teachingSessionsCompleted);
    if (r.attendanceStatus === "hadir" || r.attendanceStatus === "telat") {
      s.attendanceDays++;
      if (r.attendanceStatus === "telat") s.lateDays++;
    }
  });

  let totalMinutes = 0, totalSessions = 0, totalDays = 0, totalLate = 0;
  const perInstitution = Object.entries(stats).map(([instId, st]) => {
    totalMinutes += st.minutes;
    totalSessions += st.sessions;
    totalDays += st.attendanceDays;
    totalLate += st.lateDays;
    return {
      institutionId: Number(instId),
      institutionName: instMap[Number(instId)] || `Institusi ${instId}`,
      minutes: st.minutes,
      sessions: st.sessions,
      attendanceDays: st.attendanceDays,
      lateDays: st.lateDays,
    };
  });

  const requiredMinutes = 1440;
  return {
    teacherId,
    institutions: perInstitution,
    total: { minutes: totalMinutes, sessions: totalSessions, attendanceDays: totalDays, lateDays: totalLate },
    isRequirementMet: totalMinutes >= requiredMinutes,
    weeklyDeficit: totalMinutes >= requiredMinutes ? 0 : requiredMinutes - totalMinutes,
    periodStart: startDate.toISOString(),
    periodEnd: endDate.toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const teacherId = session.user.id || "";

    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const { periodType, periodStart, periodEnd } = TPGCrossQuerySchema.parse(params);

    let startDate: Date, endDate: Date;
    if (periodStart && periodEnd) {
      startDate = new Date(periodStart);
      endDate = new Date(periodEnd);
    } else {
      const now = new Date();
      if (periodType === "weekly") {
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }

    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");

    // Cek cache 1 jam
    const cacheRes = await pgQuery(
      `SELECT payload, cached_at FROM tpg_cross_institution_cache
       WHERE teacher_id = $1 AND period_type = $2 AND period_start = $3`,
      [teacherId, periodType, startStr]
    );
    const cached = cacheRes.rows[0];
    const satuJamLalu = new Date(Date.now() - 60 * 60 * 1000);
    if (cached && new Date(cached.cached_at) > satuJamLalu) {
      return NextResponse.json({ success: true, cached: true, ...cached.payload });
    }

    const payload = await computeCrossInstitution(teacherId, startDate, endDate, periodType);

    await pgQuery(
      `INSERT INTO tpg_cross_institution_cache (teacher_id, period_type, period_start, period_end, payload)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (teacher_id, period_type, period_start)
       DO UPDATE SET payload = $5, cached_at = CURRENT_TIMESTAMP`,
      [teacherId, periodType, startStr, endStr, JSON.stringify(payload)]
    );

    return NextResponse.json({ success: true, cached: false, ...payload });
  } catch (error: any) {
    console.error("TPG cross-institution error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validasi parameter gagal" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
