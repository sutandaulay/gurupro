import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookie } from "@/lib/session-sign";

// ==========================================
// ATP EDITOR API - Full CRUD
// Alur Tujuan Pembelajaran management
// ==========================================

// GET: List all ATP for current user/school
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = parseSessionCookie(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const userId = session.id;

    const { searchParams } = new URL(req.url);
    const school_id = searchParams.get("school_id");
    const subject_id = searchParams.get("subject_id");
    const jenjang = searchParams.get("jenjang");

    let whereClauses = ["ga.user_id = $1"];
    let params: any[] = [userId];
    let paramIdx = 2;

    if (school_id) {
      whereClauses.push(`ga.school_id = $${paramIdx++}`);
      params.push(school_id);
    }
    if (subject_id) {
      whereClauses.push(`ga.subject_id = $${paramIdx++}`);
      params.push(subject_id);
    }
    if (jenjang) {
      whereClauses.push(`ga.jenjang = $${paramIdx++}`);
      params.push(jenjang);
    }

    const whereSQL = whereClauses.join(" AND ");
    const result = await query(`
      SELECT
        ga.id,
        ga.judul_dokumen,
        ga.konten,
        ga.tanggal_kegiatan,
        ga.kurikulum,
        ga.jenjang,
        ga.fase,
        ga.dimensi8,
        ga.school_id,
        ga.subject_id,
        ga.tahun_ajaran_id,
        ga.created_at,
        s.nama_sekolah,
        sub.nama_mapel
      FROM guru_administrasi ga
      LEFT JOIN schools s ON s.id = ga.school_id
      LEFT JOIN subjects sub ON sub.id = ga.subject_id
      WHERE ga.tipe_dokumen = 'atp'
        AND ${whereSQL}
      ORDER BY ga.created_at DESC
    `, params);

    return NextResponse.json({ data: result.rows, count: result.rows.length });
  } catch (error: any) {
    console.error("ATP List Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create new ATP
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const session = parseSessionCookie(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }
    const userId = session.id;

    const body = await req.json();
    const {
      judul_dokumen,
      konten,
      school_id,
      subject_id,
      jenjang,
      kurikulum,
      fase,
      dimensi8 = [],
      tahun_ajaran_id,
      semester,
    } = body;

    if (!judul_dokumen || !konten) {
      return NextResponse.json({ error: "Judul dan konten wajib diisi" }, { status: 400 });
    }

    const result = await query(`
      INSERT INTO guru_administrasi (
        user_id, tipe_dokumen, judul_dokumen, konten,
        school_id, subject_id, jenjang, kurikulum, fase,
        dimensi8, tahun_ajaran_id, semester
      ) VALUES ($1, 'atp', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, judul_dokumen, created_at
    `, [
      userId,
      judul_dokumen,
      JSON.stringify(konten),
      school_id || null,
      subject_id || null,
      jenjang || null,
      kurikulum || null,
      fase || null,
      dimensi8 || [],
      tahun_ajaran_id || null,
      semester || null,
    ]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error("ATP Create Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
