/**
 * Admin/Kepsek: Laporan pengembangan diri guru di institusi
 */

import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";
import { parsePagination, wrapResponse } from "@/lib/pagination";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ institutionId: string }> }
) {
  try {
    const { institutionId } = await params;
    const { userId } = await requireSchoolAccess(institutionId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const offset = (page - 1) * limit;
    const period = searchParams.get("period") || new Date().toISOString().slice(0, 7); // YYYY-MM

    // Get all teachers in institution
    const teacherQuery = `
      SELECT im.app_user_id as teacher_id, u.nama_lengkap
      FROM institution_members im
      JOIN users u ON u.id::text = im.app_user_id
      WHERE im.institution_id = $1
    `;

    const teachersResult = await query(teacherQuery, [institutionId]);
    const teacherIds = teachersResult.rows.map(r => r.teacher_id);

    if (teacherIds.length === 0) {
      return NextResponse.json(wrapResponse([], 0, { page, limit }));
    }

    // Get library scores for current period
    const scoresResult = await query(
      `SELECT tls.*, u.nama_lengkap
       FROM teacher_library_score tls
       JOIN users u ON u.id = tls.teacher_id
       WHERE tls.teacher_id = ANY($1) AND tls.period_month = $2
       ORDER BY tls.total_items_completed DESC`,
      [teacherIds, period]
    );

    // Get all-time totals
    const totalsResult = await query(
      `SELECT teacher_id, SUM(total_items_completed) as all_time_completed,
              SUM(total_minutes_engaged) as all_time_minutes
       FROM teacher_library_score
       WHERE teacher_id = ANY($1)
       GROUP BY teacher_id`,
      [teacherIds]
    );

    const totalsMap: Record<string, any> = {};
    for (const r of totalsResult.rows) {
      totalsMap[r.teacher_id] = r;
    }

    // Get active teachers this month (those with progress)
    const activeResult = await query(
      `SELECT DISTINCT tlp.teacher_id
       FROM teacher_library_progress tlp
       WHERE tlp.teacher_id = ANY($1)
         AND DATE_TRUNC('month', tlp.updated_at) = DATE_TRUNC('month', $2::date)`,
      [teacherIds, period]
    );
    const activeTeacherIds = new Set(activeResult.rows.map(r => r.teacher_id));

    // Merge data
    const data = teachersResult.rows.map(t => ({
      teacher_id: t.teacher_id,
      nama_lengkap: t.nama_lengkap,
      is_active: activeTeacherIds.has(t.teacher_id),
      period_month: period,
      total_items_completed: scoresResult.rows.find(r => r.teacher_id === t.teacher_id)?.total_items_completed ?? 0,
      total_minutes_engaged: scoresResult.rows.find(r => r.teacher_id === t.teacher_id)?.total_minutes_engaged ?? 0,
      all_time_items_completed: parseInt(totalsMap[t.teacher_id]?.all_time_completed ?? '0'),
      all_time_minutes_engaged: parseInt(totalsMap[t.teacher_id]?.all_time_minutes ?? '0'),
    }));

    // Summary stats
    const totalTeachers = data.length;
    const activeTeachers = data.filter(d => d.is_active).length;
    const totalCompleted = data.reduce((sum, d) => sum + d.total_items_completed, 0);
    const avgCompleted = totalTeachers > 0 ? Math.round(totalCompleted / totalTeachers * 10) / 10 : 0;

    return NextResponse.json({
      ...wrapResponse(data, totalTeachers, { page, limit }),
      summary: {
        total_teachers: totalTeachers,
        active_teachers_this_month: activeTeachers,
        total_items_completed_this_month: totalCompleted,
        average_items_per_teacher: avgCompleted,
      },
    });
  } catch (error: any) {
    console.error("GET /api/institusi/[institutionId]/library-report error:", error);
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
