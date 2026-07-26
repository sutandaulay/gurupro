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

    const classes = await query(
      "SELECT * FROM classes WHERE school_id = $1 ORDER BY nama_kelas ASC",
      [schoolId]
    );

    let rows = classes.rows;
    if (filters.assignedKelas.length > 0) {
      rows = rows.filter((row: any) =>
        filters.assignedKelas.some((k) =>
          row.nama_kelas.toLowerCase().includes(k.toLowerCase())
        )
      );
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Classes GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireActiveTahunAjaran();
    const { id, school_id, nama_kelas, wali_kelas, wali_kelas_nip, wali_kelas_user_id } = await req.json();

    if (!school_id || !nama_kelas) {
      return NextResponse.json({ error: "school_id dan nama_kelas wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(school_id);

    if (id) {
      const res = await query(
        `UPDATE classes 
         SET nama_kelas = $1, wali_kelas = $2, wali_kelas_nip = $3, wali_kelas_user_id = $4
         WHERE id = $5 AND school_id = $6
         RETURNING *`,
        [
          nama_kelas.trim(),
          wali_kelas ? wali_kelas.trim() : null,
          wali_kelas_nip ? wali_kelas_nip.trim() : null,
          wali_kelas_user_id || null,
          id,
          school_id,
        ]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json(res.rows[0]);
    } else {
      const res = await query(
        `INSERT INTO classes (school_id, nama_kelas, wali_kelas, wali_kelas_nip, wali_kelas_user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          school_id,
          nama_kelas.trim(),
          wali_kelas ? wali_kelas.trim() : null,
          wali_kelas_nip ? wali_kelas_nip.trim() : null,
          wali_kelas_user_id || null,
        ]
      );
      return NextResponse.json(res.rows[0]);
    }
  } catch (error: any) {
    console.error("Classes POST error:", error);
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

    // Get school_id from class
    const classCheck = await query("SELECT school_id FROM classes WHERE id = $1", [id]);
    if (!classCheck.rows[0]) {
      return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(classCheck.rows[0].school_id);

    await query("DELETE FROM classes WHERE id = $1", [id]);
    return NextResponse.json({ success: true, message: "Kelas berhasil dihapus" });
  } catch (error: any) {
    console.error("Classes DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
