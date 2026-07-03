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
    const userId = await getUserId();
    await requireActiveTahunAjaran();
    const { school_id, nama_mapel } = await req.json();

    if (!school_id || !nama_mapel) {
      return NextResponse.json({ error: "school_id dan nama_mapel wajib diisi" }, { status: 400 });
    }

    await verifySchoolOwner(school_id, userId);

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

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify ownership of the subject
    const check = await query(
      `SELECT sb.id FROM subjects sb 
       JOIN schools s ON sb.school_id = s.id 
       WHERE sb.id = $1 AND s.user_id = $2`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Mata pelajaran tidak ditemukan atau tidak memiliki hak akses" }, { status: 403 });
    }

    await query("DELETE FROM subjects WHERE id = $1", [id]);
    return NextResponse.json({ success: true, message: "Mata pelajaran berhasil dihapus" });
  } catch (error: any) {
    console.error("Subjects DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
