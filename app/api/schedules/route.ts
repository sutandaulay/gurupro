import { query, requireActiveTahunAjaran } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifySchoolOwner(schoolId: string, userId: string) {
  const check = await query(
    "SELECT id FROM schools WHERE id = $1 AND user_id = $2",
    [schoolId, userId]
  );
  if (check.rows.length === 0) {
    throw new Error("Forbidden");
  }
}

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }
  const session = JSON.parse(sessionCookie);
  return session.id;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id is required" }, { status: 400 });
    }

    await verifySchoolOwner(schoolId, userId);

    const schedules = await query(
      `SELECT sc.*, c.nama_kelas, sb.nama_mapel 
       FROM schedules sc
       JOIN classes c ON sc.class_id = c.id
       JOIN subjects sb ON sc.subject_id = sb.id
       WHERE sc.school_id = $1 
       ORDER BY 
         CASE sc.hari
           WHEN 'Senin' THEN 1
           WHEN 'Selasa' THEN 2
           WHEN 'Rabu' THEN 3
           WHEN 'Kamis' THEN 4
           WHEN 'Jumat' THEN 5
           WHEN 'Sabtu' THEN 6
           WHEN 'Minggu' THEN 7
           ELSE 8
         END ASC, sc.jam_mulai ASC`,
      [schoolId]
    );
    return NextResponse.json(schedules.rows);
  } catch (error: any) {
    console.error("Schedules GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    await requireActiveTahunAjaran();
    const { school_id, class_id, subject_id, hari, jam_mulai, jam_selesai } = await req.json();

    if (!school_id || !class_id || !subject_id || !hari || !jam_mulai || !jam_selesai) {
      return NextResponse.json({ error: "Semua field jadwal wajib diisi" }, { status: 400 });
    }

    await verifySchoolOwner(school_id, userId);

    // Verify class and subject belong to the same school
    const classCheck = await query("SELECT id FROM classes WHERE id = $1 AND school_id = $2", [class_id, school_id]);
    const subjectCheck = await query("SELECT id FROM subjects WHERE id = $1 AND school_id = $2", [subject_id, school_id]);

    if (classCheck.rows.length === 0 || subjectCheck.rows.length === 0) {
      return NextResponse.json({ error: "Kelas atau Mata Pelajaran tidak valid untuk sekolah ini" }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO schedules (school_id, class_id, subject_id, hari, jam_mulai, jam_selesai)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [school_id, class_id, subject_id, hari.trim(), jam_mulai.trim(), jam_selesai.trim()]
    );
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Schedules POST error:", error);
    const isTaError = error.message?.includes?.('tahun ajaran');
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : isTaError ? 400 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify ownership of the schedule
    const check = await query(
      `SELECT sc.id FROM schedules sc 
       JOIN schools s ON sc.school_id = s.id 
       WHERE sc.id = $1 AND s.user_id = $2`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan atau tidak memiliki hak akses" }, { status: 403 });
    }

    await query("DELETE FROM schedules WHERE id = $1", [id]);
    return NextResponse.json({ success: true, message: "Jadwal berhasil dihapus" });
  } catch (error: any) {
    console.error("Schedules DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
