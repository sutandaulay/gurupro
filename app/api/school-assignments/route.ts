import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// ==========================================
// SCHOOL ASSIGNMENTS API
// Manage user-school assignments (multi-tenancy)
// ==========================================

// GET: Get all schools for current user
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    // Get schools from junction table + old schools.user_id (backward compat)
    const result = await query(`
      SELECT DISTINCT ON (s.id)
        s.id,
        s.nama_sekolah,
        s.logo,
        s.alamat,
        s.npsn,
        s.nama_kepala_sekolah,
        s.user_id as owner_id,
        CASE WHEN s.user_id = $1 THEN true ELSE false END as is_owner
      FROM schools s
      LEFT JOIN user_school_assignments usa ON usa."schoolId" = s.id AND usa."userId" = $1
      WHERE s.user_id = $1 OR usa."userId" = $1
      ORDER BY s.id
    `, [userId]);

    return NextResponse.json({ data: result.rows, count: result.rows.length });
  } catch (error: any) {
    console.error("Get Schools Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Assign user to a school
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
    const { school_id, tahun_ajaran_id } = body;

    if (!school_id) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    // Check if school exists
    const schoolCheck = await query("SELECT id FROM schools WHERE id = $1", [school_id]);
    if (schoolCheck.rows.length === 0) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });
    }

    // Insert assignment (or ignore if exists)
    const result = await query(`
      INSERT INTO user_school_assignments (userId, schoolId, tahunAjaranId)
      VALUES ($1, $2, $3)
      ON CONFLICT (userId, schoolId, tahunAjaranId) DO NOTHING
      RETURNING id
    `, [userId, school_id, tahun_ajaran_id || null]);

    return NextResponse.json({
      success: true,
      assignment_id: result.rows[0]?.id,
      message: result.rows[0] ? "Berhasil ditambahkan" : "Sudah ada sebelumnya"
    }, { status: 201 });
  } catch (error: any) {
    console.error("Assign School Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove user from a school
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

    if (!school_id) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    // Cannot remove if user is the school owner
    const ownerCheck = await query("SELECT user_id FROM schools WHERE id = $1", [school_id]);
    if (ownerCheck.rows.length > 0 && ownerCheck.rows[0].user_id === userId) {
      return NextResponse.json({
        error: "Tidak dapat menghapus sekolah sendiri. Hubungi admin."
      }, { status: 403 });
    }

    await query(`
      DELETE FROM user_school_assignments
      WHERE "userId" = $1 AND "schoolId" = $2
    `, [userId, school_id]);

    return NextResponse.json({ success: true, message: "Berhasil dihapus" });
  } catch (error: any) {
    console.error("Remove School Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
