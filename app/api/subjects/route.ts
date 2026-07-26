import { query, requireActiveTahunAjaran } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess, getUserId } from "@/lib/school-access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id is required" }, { status: 400 });
    }

    await requireSchoolAccess(schoolId);

    const subjects = await query(
      "SELECT * FROM subjects WHERE school_id = $1 ORDER BY nama_mapel ASC",
      [schoolId]
    );
    return NextResponse.json(subjects.rows);
  } catch (error: any) {
    console.error("Subjects GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireActiveTahunAjaran();
    const { school_id, nama_mapel } = await req.json();

    if (!school_id || !nama_mapel) {
      return NextResponse.json({ error: "school_id dan nama_mapel wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(school_id);

    const res = await query(
      `INSERT INTO subjects (school_id, nama_mapel)
       VALUES ($1, $2)
       RETURNING *`,
      [school_id, nama_mapel.trim()]
    );
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Subjects POST error:", error);
    const isTaError = error.message?.includes?.('tahun ajaran');
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : isTaError ? 400 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    await requireActiveTahunAjaran();
    const { id, nama_mapel } = await req.json();

    if (!id || !nama_mapel) {
      return NextResponse.json({ error: "id dan nama_mapel wajib diisi" }, { status: 400 });
    }

    const subjCheck = await query("SELECT school_id FROM subjects WHERE id = $1", [id]);
    if (!subjCheck.rows[0]) {
      return NextResponse.json({ error: "Mata pelajaran tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(subjCheck.rows[0].school_id);

    const res = await query(
      "UPDATE subjects SET nama_mapel = $1 WHERE id = $2 RETURNING *",
      [nama_mapel.trim(), id]
    );
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Subjects PUT error:", error);
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

    // Get school_id from subject
    const subjCheck = await query("SELECT school_id FROM subjects WHERE id = $1", [id]);
    if (!subjCheck.rows[0]) {
      return NextResponse.json({ error: "Mata pelajaran tidak ditemukan" }, { status: 404 });
    }
    await requireSchoolAccess(subjCheck.rows[0].school_id);

    await query("DELETE FROM subjects WHERE id = $1", [id]);
    return NextResponse.json({ success: true, message: "Mata pelajaran berhasil dihapus" });
  } catch (error: any) {
    console.error("Subjects DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
