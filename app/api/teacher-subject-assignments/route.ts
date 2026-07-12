import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getContextFilters } from "@/lib/session";

// ==========================================
// TEACHER SUBJECT ASSIGNMENTS API
// Manage user-subject assignments per school
// ==========================================

// GET: Get all subjects for current user at a school
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;
    const filters = await getContextFilters(userId);

    const { searchParams } = new URL(req.url);
    const school_id = searchParams.get("school_id");

    if (!school_id) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    // Get subjects from junction table
    const result = await query(`
      SELECT DISTINCT ON (sub.id)
        sub.id,
        sub.nama_mapel,
        s.nama_sekolah,
        usa."tahunAjaranId" as tahun_ajaran_id
      FROM subjects sub
      INNER JOIN teacher_subject_assignments tsa ON tsa."subjectId" = sub.id
      INNER JOIN schools s ON s.id = sub.school_id
      LEFT JOIN user_school_assignments usa ON usa."schoolId" = s.id AND usa."userId" = $1
      WHERE tsa."userId" = $1
        AND tsa."schoolId" = $2
      ORDER BY sub.id
    `, [userId, school_id]);

    let rows = result.rows;
    if (filters.assignedMapel.length > 0) {
      rows = rows.filter((row: any) =>
        filters.assignedMapel.some((m) =>
          row.nama_mapel.toLowerCase().includes(m.toLowerCase())
        )
      );
    }

    return NextResponse.json({ data: rows, count: rows.length });
  } catch (error: any) {
    console.error("Get Subject Assignments Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Assign subject to user
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const body = await req.json();
    const { school_id, subject_id, tahun_ajaran_id } = body;

    if (!school_id || !subject_id) {
      return NextResponse.json({ error: "school_id dan subject_id wajib diisi" }, { status: 400 });
    }

    // Check if subject exists and belongs to school
    const subjectCheck = await query(
      "SELECT id FROM subjects WHERE id = $1 AND school_id = $2",
      [subject_id, school_id]
    );
    if (subjectCheck.rows.length === 0) {
      return NextResponse.json({ error: "Mata pelajaran tidak ditemukan di sekolah ini" }, { status: 404 });
    }

    // Insert assignment
    const result = await query(`
      INSERT INTO teacher_subject_assignments (userId, schoolId, subjectId, tahunAjaranId)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (userId, schoolId, subjectId, tahunAjaranId) DO NOTHING
      RETURNING id
    `, [userId, school_id, subject_id, tahun_ajaran_id || null]);

    return NextResponse.json({
      success: true,
      assignment_id: result.rows[0]?.id,
      message: result.rows[0] ? "Berhasil ditambahkan" : "Sudah ada sebelumnya"
    }, { status: 201 });
  } catch (error: any) {
    console.error("Assign Subject Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove subject assignment
export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const { searchParams } = new URL(req.url);
    const school_id = searchParams.get("school_id");
    const subject_id = searchParams.get("subject_id");

    if (!school_id || !subject_id) {
      return NextResponse.json({ error: "school_id dan subject_id wajib diisi" }, { status: 400 });
    }

    await query(`
      DELETE FROM teacher_subject_assignments
      WHERE "userId" = $1
        AND "schoolId" = $2
        AND "subjectId" = $3
    `, [userId, school_id, subject_id]);

    return NextResponse.json({ success: true, message: "Berhasil dihapus" });
  } catch (error: any) {
    console.error("Remove Subject Assignment Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
