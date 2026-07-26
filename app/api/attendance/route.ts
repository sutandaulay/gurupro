import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "teacher") {
      const schoolId = searchParams.get("school_id");
      if (!schoolId) {
        return NextResponse.json({ error: "school_id is required" }, { status: 400 });
      }

      const { userId } = await requireSchoolAccess(schoolId);

      const logs = await query(
        "SELECT * FROM teacher_attendance WHERE user_id = $1 AND school_id = $2 ORDER BY tanggal DESC",
        [userId, schoolId]
      );
      return NextResponse.json(logs.rows);
    } 
    
    if (type === "student") {
      const scheduleId = searchParams.get("schedule_id");
      const tanggal = searchParams.get("tanggal");

      if (!scheduleId || !tanggal) {
        return NextResponse.json({ error: "schedule_id dan tanggal wajib diisi" }, { status: 400 });
      }

      const schedCheck = await query("SELECT school_id FROM schedules WHERE id = $1", [scheduleId]);
      if (!schedCheck.rows[0]) {
        return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
      }
      await requireSchoolAccess(schedCheck.rows[0].school_id);

      const logs = await query(
        `SELECT sa.*, s.nama_siswa, s.nomor_absen 
         FROM student_attendance sa
         JOIN students s ON sa.student_id = s.id
         WHERE sa.schedule_id = $1 AND sa.tanggal = $2
         ORDER BY s.nomor_absen ASC, s.nama_siswa ASC`,
        [scheduleId, tanggal]
      );
      return NextResponse.json(logs.rows);
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error: any) {
    console.error("Attendance GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type } = body;

    if (type === "teacher") {
      const { school_id, tanggal, status, catatan, face_match_score, latitude, longitude, accuracy, liveness_passed } = body;

      if (!school_id || !tanggal || !status) {
        return NextResponse.json({ error: "school_id, tanggal, dan status wajib diisi" }, { status: 400 });
      }

      const { userId } = await requireSchoolAccess(school_id);

      // Auto-save school coordinates on first verified check-in
      if (latitude && longitude && face_match_score) {
        const schoolCheck = await query(
          "SELECT location_latitude FROM schools WHERE id = $1",
          [school_id]
        );
        if (schoolCheck.rows.length > 0 && !schoolCheck.rows[0].location_latitude) {
          await query(
            `UPDATE schools 
             SET location_latitude = $1, location_longitude = $2, attendance_radius_meters = COALESCE(attendance_radius_meters, 100) 
             WHERE id = $3`,
            [parseFloat(latitude), parseFloat(longitude), school_id]
          );
        }
      }

      // Delete existing record for user, school, date to prevent duplicates
      await query(
        "DELETE FROM teacher_attendance WHERE user_id = $1 AND school_id = $2 AND tanggal = $3",
        [userId, school_id, tanggal]
      );

      // Insert new log with optional verification data
      const res = await query(
        `INSERT INTO teacher_attendance 
          (user_id, school_id, tanggal, status, catatan, face_match_score, latitude, longitude, accuracy, liveness_passed) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
         RETURNING *`,
        [
          userId, 
          school_id, 
          tanggal, 
          status, 
          catatan || null,
          face_match_score || null,
          latitude || null,
          longitude || null,
          accuracy || null,
          liveness_passed || false
        ]
      );
      return NextResponse.json(res.rows[0]);
    }

    if (type === "student") {
      const { schedule_id, tanggal, records } = body;

      if (!schedule_id || !tanggal || !Array.isArray(records)) {
        return NextResponse.json({ error: "schedule_id, tanggal, dan records wajib diisi" }, { status: 400 });
      }

      const schedCheck = await query("SELECT school_id FROM schedules WHERE id = $1", [schedule_id]);
      if (!schedCheck.rows[0]) {
        return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
      }
      await requireSchoolAccess(schedCheck.rows[0].school_id);

      await query("BEGIN");
      try {
        // Delete existing logs for this schedule on this date
        await query(
          "DELETE FROM student_attendance WHERE schedule_id = $1 AND tanggal = $2",
          [schedule_id, tanggal]
        );

        // Batch insert student attendance
        for (const rec of records) {
          if (!rec.student_id || !rec.status) continue;
          await query(
            `INSERT INTO student_attendance (schedule_id, student_id, tanggal, status, catatan)
             VALUES ($1, $2, $3, $4, $5)`,
            [schedule_id, rec.student_id, tanggal, rec.status, rec.catatan || null]
          );
        }

        await query("COMMIT");
      } catch (dbErr: any) {
        await query("ROLLBACK");
        throw dbErr;
      }

      return NextResponse.json({ success: true, message: "Absensi siswa berhasil disimpan" });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error: any) {
    console.error("Attendance POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
