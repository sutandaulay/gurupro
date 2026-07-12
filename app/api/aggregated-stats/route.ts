import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.id;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const today = now.toISOString().split('T')[0];
    const startStr = startOfMonth.toISOString().split('T')[0];
    const endStr = endOfMonth.toISOString().split('T')[0];

    let journalData = { total_journals: 0, completed_count: 0, missing_count: 0, on_time_count: 0, late_count: 0 };
    let rppData = { total_rpp: 0 };
    let lkpdData = { total_lkpd: 0 };
    let bankSoalData = { total_soal: 0 };
    let assessmentData = { total_assessments: 0 };

    // Get Journal stats - check if table exists first
    try {
      const journalStats = await query(`
        SELECT
          COUNT(*)::integer as total_journals,
          COUNT(CASE WHEN tanggal <= $3 THEN 1 END)::integer as completed_count,
          COUNT(CASE WHEN tanggal < $3 AND (catatan IS NULL OR catatan = '') THEN 1 END)::integer as missing_count,
          COUNT(CASE WHEN status ILIKE '%selesai%' OR status ILIKE '%done%' THEN 1 END)::integer as on_time_count,
          0::integer as late_count
        FROM teacher_journals
        WHERE teacher_id = $1 AND school_id = $2
          AND tanggal >= $4 AND tanggal <= $5
      `, [userId, schoolId, today, startStr, endStr]);
      if (journalStats.rows[0]) {
        journalData = journalStats.rows[0];
      }
    } catch (e) {
      console.log("Journal table may not exist or has different schema:", e);
    }

    // Get RPP/Modul Ajar stats - check payload tables
    try {
      const rppStats = await query(`
        SELECT COUNT(*)::integer as total_rpp
        FROM modul_ajar
        WHERE user_id = $1 AND (school_id = $2 OR school_id IS NULL)
      `, [userId, schoolId]);
      if (rppStats.rows[0]) {
        rppData = rppStats.rows[0];
      }
    } catch (e) {
      console.log("Modul Ajar table query failed:", e);
    }

    // Get LKPD stats
    try {
      const lkpdStats = await query(`
        SELECT COUNT(*)::integer as total_lkpd
        FROM lkpd
        WHERE user_id = $1 AND (school_id = $2 OR school_id IS NULL)
      `, [userId, schoolId]);
      if (lkpdStats.rows[0]) {
        lkpdData = lkpdStats.rows[0];
      }
    } catch (e) {
      console.log("LKPD table query failed:", e);
    }

    // Get Bank Soal stats
    try {
      const bankSoalStats = await query(`
        SELECT COUNT(*)::integer as total_soal
        FROM bank_soal
        WHERE user_id = $1 AND (school_id = $2 OR school_id IS NULL)
      `, [userId, schoolId]);
      if (bankSoalStats.rows[0]) {
        bankSoalData = bankSoalStats.rows[0];
      }
    } catch (e) {
      console.log("Bank Soal table query failed:", e);
    }

    // Get Assessment stats
    try {
      const assessmentStats = await query(`
        SELECT COUNT(*)::integer as total_assessments
        FROM laporan_evaluasi_lkpd
        WHERE user_id = $1 AND (school_id = $2 OR school_id IS NULL)
      `, [userId, schoolId]);
      if (assessmentStats.rows[0]) {
        assessmentData = assessmentStats.rows[0];
      }
    } catch (e) {
      console.log("Assessment table query failed:", e);
    }

    const totalJurnal = Number(journalData.total_journals) || 0;
    const totalRpp = Number(rppData.total_rpp) || 0;
    const totalLkpd = Number(lkpdData.total_lkpd) || 0;
    const totalBankSoal = Number(bankSoalData.total_soal) || 0;
    const completedJurnal = Number(journalData.completed_count) || 0;
    const missingJurnal = Number(journalData.missing_count) || 0;

    const totalActivities = totalJurnal + totalRpp + totalLkpd + totalBankSoal;
    const completedActivities = completedJurnal + Math.min(totalRpp, 5) + Math.min(totalLkpd, 3) + Math.min(totalBankSoal, 2);

    const jurnalCompletionRate = totalJurnal > 0 ? Math.round((completedJurnal / totalJurnal) * 100) : 0;
    const rppCompletionRate = totalRpp > 0 ? Math.min(100, Math.round((totalRpp / 10) * 100)) : 0;

    return NextResponse.json({
      period: `${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
      totalActivities,
      completedActivities,
      onTimeCount: completedJurnal,
      lateCount: Number(journalData.late_count) || 0,
      missingCount: missingJurnal,
      rppCompletionRate,
      jurnalCompletionRate,
      bankSoalCompletionRate: totalBankSoal > 0 ? Math.min(100, Math.round((totalBankSoal / 5) * 100)) : 0,
      lkpdCompletionRate: totalLkpd > 0 ? Math.min(100, Math.round((totalLkpd / 5) * 100)) : 0,
      totalRpp,
      totalJurnal,
      totalBankSoal,
      totalLkpd,
      totalAssessments: Number(assessmentData.total_assessments) || 0,
      lastActivityDate: now.toISOString(),
      _debug: {
        sessionUserId: userId,
        schoolId,
        journalData,
        rppData,
        lkpdData,
        bankSoalData
      }
    });
  } catch (error: any) {
    console.error("Aggregated Stats error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error", detail: error.stack },
      { status: 500 }
    );
  }
}
