import { query, requireActiveTahunAjaran } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";
import { parsePagination, offset, wrapResponse } from "@/lib/pagination";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("class_id");

    if (!classId) {
      return NextResponse.json({ error: "class_id is required" }, { status: 400 });
    }

    const classCheck = await query("SELECT school_id FROM classes WHERE id = $1", [classId]);
    if (!classCheck.rows[0]) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(classCheck.rows[0].school_id);

    const pag = parsePagination(searchParams);

    const countRes = await query(
      "SELECT COUNT(*)::int as total FROM students WHERE class_id = $1",
      [classId]
    );
    const total = countRes.rows[0].total;

    const students = await query(
      "SELECT * FROM students WHERE class_id = $1 ORDER BY nomor_absen ASC, nama_siswa ASC LIMIT $2 OFFSET $3",
      [classId, pag.limit, offset(pag)]
    );
    return NextResponse.json(wrapResponse(students.rows, total, pag));
  } catch (error: any) {
    console.error("Students GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireActiveTahunAjaran();
    const { id, class_id, nama_siswa, nisn, nomor_absen } = await req.json();

    if (!class_id || !nama_siswa) {
      return NextResponse.json({ error: "class_id dan nama_siswa wajib diisi" }, { status: 400 });
    }

    const classCheck = await query("SELECT school_id FROM classes WHERE id = $1", [class_id]);
    if (!classCheck.rows[0]) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(classCheck.rows[0].school_id);

    if (id) {
      // Edit student
      const res = await query(
        `UPDATE students 
         SET nama_siswa = $1, nisn = $2, nomor_absen = $3 
         WHERE id = $4 AND class_id = $5
         RETURNING *`,
        [nama_siswa.trim(), nisn ? nisn.trim() : null, nomor_absen ? parseInt(nomor_absen) : null, id, class_id]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json(res.rows[0]);
    } else {
      // Insert student
      const res = await query(
        `INSERT INTO students (class_id, nama_siswa, nisn, nomor_absen)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [class_id, nama_siswa.trim(), nisn ? nisn.trim() : null, nomor_absen ? parseInt(nomor_absen) : null]
      );
      return NextResponse.json(res.rows[0]);
    }
  } catch (error: any) {
    console.error("Students POST error:", error);
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

    const studentCheck = await query(
      "SELECT c.school_id FROM students st JOIN classes c ON st.class_id = c.id WHERE st.id = $1",
      [id]
    );
    if (!studentCheck.rows[0]) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(studentCheck.rows[0].school_id);

    await query("DELETE FROM students WHERE id = $1", [id]);
    return NextResponse.json({ success: true, message: "Siswa berhasil dihapus" });
  } catch (error: any) {
    console.error("Students DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
