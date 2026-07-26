import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");
    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(schoolId);

    const users = await query(
      `SELECT DISTINCT u.id, u.username, u.email, u.nama_lengkap, u.role
       FROM users u
       LEFT JOIN schools s ON s.user_id = u.id
       LEFT JOIN user_school_assignments usa ON usa."userId" = u.id
       WHERE s.id = $1 OR usa."schoolId" = $1
       ORDER BY u.nama_lengkap ASC`,
      [schoolId]
    );
    return NextResponse.json(users.rows);
  } catch (error: any) {
    const status = error.message === "Forbidden" ? 403 : error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
