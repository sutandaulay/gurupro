import { query } from "@/lib/db";
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

    const classes = await query(
      "SELECT * FROM classes WHERE school_id = $1 ORDER BY nama_kelas ASC",
      [schoolId]
    );
    return NextResponse.json(classes.rows);
  } catch (error: any) {
    console.error("Classes GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const { id, school_id, nama_kelas, wali_kelas } = await req.json();

    if (!school_id || !nama_kelas) {
      return NextResponse.json({ error: "school_id dan nama_kelas wajib diisi" }, { status: 400 });
    }

    await verifySchoolOwner(school_id, userId);

    if (id) {
      // Update
      const res = await query(
        `UPDATE classes 
         SET nama_kelas = $1, wali_kelas = $2
         WHERE id = $3 AND school_id = $4
         RETURNING *`,
        [nama_kelas.trim(), wali_kelas ? wali_kelas.trim() : null, id, school_id]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json(res.rows[0]);
    } else {
      // Insert
      const res = await query(
        `INSERT INTO classes (school_id, nama_kelas, wali_kelas)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [school_id, nama_kelas.trim(), wali_kelas ? wali_kelas.trim() : null]
      );
      return NextResponse.json(res.rows[0]);
    }
  } catch (error: any) {
    console.error("Classes POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
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

    // Verify ownership of the class by checking if it belongs to a school owned by user
    const check = await query(
      `SELECT c.id FROM classes c 
       JOIN schools s ON c.school_id = s.id 
       WHERE c.id = $1 AND s.user_id = $2`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Kelas tidak ditemukan atau tidak memiliki hak akses" }, { status: 403 });
    }

    await query("DELETE FROM classes WHERE id = $1", [id]);
    return NextResponse.json({ success: true, message: "Kelas berhasil dihapus" });
  } catch (error: any) {
    console.error("Classes DELETE error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
