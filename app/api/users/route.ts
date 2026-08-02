import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireSchoolAccess } from "@/lib/school-access";
import { parsePagination, wrapResponse } from "@/lib/pagination";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");
    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    await requireSchoolAccess(schoolId);

    const whereClause = `(s.id = $1 OR usa."schoolId" = $1)`;

    const countResult = await query(
      `SELECT COUNT(DISTINCT u.id)
       FROM users u
       LEFT JOIN schools s ON s.user_id = u.id
       LEFT JOIN user_school_assignments usa ON usa."userId" = u.id
       WHERE ${whereClause}`,
      [schoolId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const pagination = parsePagination(searchParams);
    const off = (pagination.page - 1) * pagination.limit;

    const users = await query(
      `SELECT DISTINCT u.id, u.username, u.email, u.nama_lengkap, u.role
       FROM users u
       LEFT JOIN schools s ON s.user_id = u.id
       LEFT JOIN user_school_assignments usa ON usa."userId" = u.id
       WHERE ${whereClause}
       ORDER BY u.nama_lengkap ASC
       LIMIT ${pagination.limit} OFFSET ${off}`,
      [schoolId]
    );
    return NextResponse.json(wrapResponse(users.rows, total, pagination));
  } catch (error: any) {
    const status = error.message === "Forbidden" ? 403 : error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
