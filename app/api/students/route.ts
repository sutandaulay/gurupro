import { query, requireActiveTahunAjaran } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";
import { parsePagination, offset, wrapResponse } from "@/lib/pagination";
import { logger } from "@/lib/logger";
import { captureError, errorResponse } from "@/lib/api-error";
import { globalRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

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
    captureError(error, { route: '/api/students', method: 'GET' });
    return NextResponse.json(errorResponse(error, 'Gagal mengambil data siswa'));
  }
}

export async function POST(req: Request) {
  try {
    const { id, class_id, nama_siswa, nisn, nomor_absen } = await req.json();

    if (!class_id || !nama_siswa) {
      return NextResponse.json({ error: "class_id dan nama_siswa wajib diisi" }, { status: 400 });
    }

    const classCheck = await query("SELECT school_id FROM classes WHERE id = $1", [class_id]);
    if (!classCheck.rows[0]) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    const schoolId = classCheck.rows[0].school_id;
    await requireSchoolAccess(schoolId);

    // Check if this is the first student in THIS school (per-school_id scope).
    // Each school bootstraps independently — if Sekolah #2 has no siswa yet,
    // the first one can be added even if the guru already has an active TA
    // from a different school. Schools are isolated; guru can activate TA
    // for each school separately via Pengaturan. This is intentional.
    const existingStudent = await query(
      `SELECT 1 FROM students s JOIN classes c ON c.id = s.class_id
       WHERE c.school_id = $1 LIMIT 1`,
      [schoolId]
    );
    if (existingStudent.rows.length === 0 && !id) {
      // First student in school — skip requireActiveTahunAjaran (school was just created)
    } else {
      try {
        await requireActiveTahunAjaran();
      } catch {
        return NextResponse.json(
          { error: 'Tidak ada tahun ajaran aktif. Silakan buat dan aktifkan tahun ajaran di menu Pengaturan.' },
          { status: 400 }
        );
      }
    }

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
    captureError(error, { route: '/api/students', method: 'POST' });
    const isTaError = error.message?.includes?.('tahun ajaran');
    return NextResponse.json(errorResponse(error, isTaError ? error.message : 'Gagal menyimpan siswa'));
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
    captureError(error, { route: '/api/students', method: 'DELETE' });
    return NextResponse.json(errorResponse(error, 'Gagal menghapus siswa'));
  }
}
