import { query, requireActiveTahunAjaran } from "@/lib/db";
import { NextResponse } from "next/server";
import { getContextFilters } from "@/lib/session";
import { requireSchoolAccess } from "@/lib/school-access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id is required" }, { status: 400 });
    }

    const { userId } = await requireSchoolAccess(schoolId);
    const filters = await getContextFilters(userId);

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

    let rows = schedules.rows;
    if (filters.assignedMapel.length > 0 || filters.assignedKelas.length > 0) {
      rows = rows.filter((row: any) => {
        const matchMapel = filters.assignedMapel.length === 0 ||
          (row.nama_mapel && filters.assignedMapel.some((m) =>
            row.nama_mapel.toLowerCase().includes(m.toLowerCase())
          ));
        const matchKelas = filters.assignedKelas.length === 0 ||
          (row.nama_kelas && filters.assignedKelas.some((k) =>
            row.nama_kelas.toLowerCase().includes(k.toLowerCase())
          ));
        return matchMapel && matchKelas;
      });
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Schedules GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireActiveTahunAjaran();
    const { school_id, class_id, subject_id, hari, jam_mulai, jam_selesai } = await req.json();

    if (!school_id || !class_id || !subject_id || !hari || !jam_mulai || !jam_selesai) {
      return NextResponse.json({ error: "Semua field jadwal wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(school_id);

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

export async function PUT(req: Request) {
  try {
    await requireActiveTahunAjaran();
    const { id, class_id, subject_id, hari, jam_mulai, jam_selesai } = await req.json();

    if (!id || !class_id || !subject_id || !hari || !jam_mulai || !jam_selesai) {
      return NextResponse.json({ error: "Semua field jadwal wajib diisi" }, { status: 400 });
    }

    const schedCheck = await query("SELECT school_id FROM schedules WHERE id = $1", [id]);
    if (!schedCheck.rows[0]) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(schedCheck.rows[0].school_id);

    const res = await query(
      `UPDATE schedules SET class_id = $1, subject_id = $2, hari = $3, jam_mulai = $4, jam_selesai = $5
       WHERE id = $6 RETURNING *`,
      [class_id, subject_id, hari.trim(), jam_mulai.trim(), jam_selesai.trim(), id]
    );
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Schedules PUT error:", error);
    const isTaError = error.message?.includes?.('tahun ajaran');
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : isTaError ? 400 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Get school_id from schedule
    const schedCheck = await query("SELECT school_id FROM schedules WHERE id = $1", [id]);
    if (!schedCheck.rows[0]) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(schedCheck.rows[0].school_id);

    await query("DELETE FROM schedules WHERE id = $1", [id]);
    return NextResponse.json({ success: true, message: "Jadwal berhasil dihapus" });
  } catch (error: any) {
    console.error("Schedules DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
