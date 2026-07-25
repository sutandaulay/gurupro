import { query, logAudit } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const assessmentId = searchParams.get("assessment_id");

    if (!assessmentId) {
      return NextResponse.json({ error: "assessment_id wajib diisi" }, { status: 400 });
    }

    const res = await query(
      `SELECT 
        s.id AS student_id,
        s.nama_siswa,
        s.nomor_absen,
        s.nisn,
        sg.id AS grade_id,
        sg.nilai_awal,
        sg.nilai_remedial,
        sg.nilai_akhir,
        sg.status_remedial,
        sg.catatan
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN assessments a ON a.class_id = c.id
      LEFT JOIN student_grades sg ON sg.student_id = s.id AND sg.assessment_id = a.id
      WHERE a.id = $1
      ORDER BY s.nomor_absen ASC, s.nama_siswa ASC`,
      [assessmentId]
    );

    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("Student Grades GET error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat nilai siswa." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const body = await req.json();

    // Check if it's a batch import (array) or a single save
    const isArray = Array.isArray(body);
    const items = isArray ? body : [body];

    if (items.length === 0) {
      return NextResponse.json({ error: "Data nilai tidak boleh kosong" }, { status: 400 });
    }

    // Get assessment details (especially KKM and name for logging)
    const assessmentId = items[0].assessment_id;
    if (!assessmentId) {
      return NextResponse.json({ error: "assessment_id wajib diisi" }, { status: 400 });
    }

    const assessRes = await query("SELECT nama_asesmen, kkm FROM assessments WHERE id = $1", [assessmentId]);
    if (assessRes.rows.length === 0) {
      return NextResponse.json({ error: "Asesmen tidak ditemukan" }, { status: 404 });
    }
    const { nama_asesmen, kkm } = assessRes.rows[0];

    for (const item of items) {
      const { student_id, nilai_awal, nilai_remedial, catatan } = item;

      if (!student_id || nilai_awal === undefined) {
        continue; // skip invalid entries
      }

      const valAwal = Number(nilai_awal);
      const valRem = nilai_remedial !== null && nilai_remedial !== undefined && nilai_remedial !== "" ? Number(nilai_remedial) : null;
      const catatanText = catatan || null;

      let valAkhir = valAwal;
      let statusRem = "Lulus";

      if (valAwal >= kkm) {
        valAkhir = valAwal;
        statusRem = "Lulus";
      } else {
        if (valRem !== null) {
          // Remedial grade caps at KKM
          const cappedRem = Math.min(valRem, kkm);
          valAkhir = Math.max(valAwal, cappedRem);
          statusRem = valAkhir >= kkm ? "Lulus" : "Butuh Remedial";
        } else {
          valAkhir = valAwal;
          statusRem = "Butuh Remedial";
        }
      }

      // Check if exists
      const existRes = await query(
        "SELECT id FROM student_grades WHERE assessment_id = $1 AND student_id = $2",
        [assessmentId, student_id]
      );

      if (existRes.rows.length > 0) {
        // Update
        await query(
          `UPDATE student_grades
           SET nilai_awal = $1, nilai_remedial = $2, nilai_akhir = $3, status_remedial = $4, catatan = $5
           WHERE assessment_id = $6 AND student_id = $7`,
          [valAwal, valRem, valAkhir, statusRem, catatanText, assessmentId, student_id]
        );
      } else {
        // Insert
        await query(
          `INSERT INTO student_grades (assessment_id, student_id, nilai_awal, nilai_remedial, nilai_akhir, status_remedial, catatan)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [assessmentId, student_id, valAwal, valRem, valAkhir, statusRem, catatanText]
        );
      }
    }

    await logAudit(
      userId,
      "SAVE_GRADES",
      `Mengisi/memperbarui data nilai siswa untuk asesmen: ${nama_asesmen} (KKM: ${kkm})`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Student Grades POST error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan nilai siswa." }, { status: 500 });
  }
}
