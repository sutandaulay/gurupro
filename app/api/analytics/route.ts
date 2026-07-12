import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    const session = sessionCookie ? JSON.parse(sessionCookie) : null;
    const userId = session?.id;

    // 1. Count master metrics
    const classCount = await query("SELECT COUNT(*) AS count FROM classes WHERE school_id = $1", [schoolId]);
    const subjectCount = await query("SELECT COUNT(*) AS count FROM subjects WHERE school_id = $1", [schoolId]);
    const scheduleCount = await query("SELECT COUNT(*) AS count FROM schedules WHERE school_id = $1", [schoolId]);
    const studentCount = await query(
      "SELECT COUNT(s.id) AS count FROM students s JOIN classes c ON s.class_id = c.id WHERE c.school_id = $1",
      [schoolId]
    );

    // 2. Journal status summary
    const journalSummary = await query(
      `SELECT status, COUNT(*) AS count 
       FROM teacher_journals 
       WHERE school_id = $1 
       GROUP BY status`,
      [schoolId]
    );

    // 3. Grades summary (Remedial vs Lulus)
    const gradeSummary = await query(
      `SELECT sg.status_remedial, COUNT(sg.id) AS count
       FROM student_grades sg
       JOIN assessments a ON sg.assessment_id = a.id
       WHERE a.school_id = $1
       GROUP BY sg.status_remedial`,
      [schoolId]
    );

    // 4. Average final grade by assessment type
    const avgGrades = await query(
      `SELECT a.tipe_asesmen, ROUND(AVG(sg.nilai_akhir), 1) as avg_nilai, COUNT(sg.id) as total_murid
       FROM student_grades sg
       JOIN assessments a ON sg.assessment_id = a.id
       WHERE a.school_id = $1
       GROUP BY a.tipe_asesmen`,
      [schoolId]
    );

    // 5. Active teachers (those who filled journals in this school)
    const activeTeachers = await query(
      `SELECT COUNT(DISTINCT teacher_id) as count 
       FROM teacher_journals 
       WHERE school_id = $1`,
      [schoolId]
    );

    // 6. Recent journal activities for timeline
    const recentActivity = await query(
      `SELECT tj.id, u.nama_lengkap as nama_guru, c.nama_kelas, sub.nama_mapel, tj.tanggal, tj.status, tj.materi_pembelajaran
       FROM teacher_journals tj
       JOIN users u ON tj.teacher_id = u.id
       JOIN classes c ON tj.class_id = c.id
       JOIN subjects sub ON tj.subject_id = sub.id
       WHERE tj.school_id = $1
       ORDER BY tj.created_at DESC
       LIMIT 5`,
      [schoolId]
    );

    // 7. RPP count this month (for the current user & selected school)
    let rppThisMonth = 0;
    if (userId) {
      const rppRes = await query(
        `SELECT COUNT(*) AS count FROM guru_administrasi
         WHERE user_id = $1 AND tipe_dokumen = 'rpp'
           AND school_id = $2
           AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [userId, schoolId]
      );
      rppThisMonth = Number(rppRes.rows[0].count);
    }

    // 8. Overall average grade across all assessment types
    const avgAllGrades = await query(
      `SELECT ROUND(AVG(sg.nilai_akhir), 1) as avg_nilai
       FROM student_grades sg
       JOIN assessments a ON sg.assessment_id = a.id
       WHERE a.school_id = $1`,
      [schoolId]
    );

    // 9. Ungraded assessments (assessments with NO student_grades)
    const ungradedRes = await query(
      `SELECT COUNT(*) AS count FROM (
        SELECT a.id
        FROM assessments a
        WHERE a.school_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM student_grades sg WHERE sg.assessment_id = a.id
          )
      ) sub`,
      [schoolId]
    );

    return NextResponse.json({
      summary: {
        total_classes: Number(classCount.rows[0].count),
        total_subjects: Number(subjectCount.rows[0].count),
        total_schedules: Number(scheduleCount.rows[0].count),
        total_students: Number(studentCount.rows[0].count),
        active_teachers: Number(activeTeachers.rows[0].count || 0) + 1,
        rpp_this_month: rppThisMonth,
        avg_grade: Number(avgAllGrades.rows[0]?.avg_nilai || 0),
        ungraded_tasks: Number(ungradedRes.rows[0].count),
      },
      journals: journalSummary.rows,
      grades: gradeSummary.rows,
      average_grades: avgGrades.rows,
      recent_activity: recentActivity.rows
    });
  } catch (error: any) {
    console.error("Analytics GET error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat analitik." }, { status: 500 });
  }
}
