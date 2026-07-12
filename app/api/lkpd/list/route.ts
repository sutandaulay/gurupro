import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";

/**
 * GET /api/lkpd/list
 * List LKPD documents for selection in Laporan Evaluasi form
 * Accessible by authenticated users
 */
export async function GET(req: Request) {
  try {
    // Auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");
    const userId = session.id;

    let queryStr = `
      SELECT
        id,
        judul_dokumen,
        created_at,
        jenjang,
        fase,
        school_id
      FROM guru_administrasi
      WHERE tipe_dokumen = 'lkpd'
    `;
    const params: any[] = [];

    // Filter by user if no school context
    if (!schoolId) {
      params.push(userId);
      queryStr += ` AND user_id = $${params.length}`;
    } else {
      params.push(schoolId);
      queryStr += ` AND school_id = $${params.length}`;
    }

    queryStr += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await query(queryStr, params);

    return NextResponse.json({
      lkpd: result.rows.map((row) => ({
        id: row.id,
        judul: row.judul_dokumen,
        jenjang: row.jenjang,
        fase: row.fase,
        createdAt: row.created_at,
      })),
    });
  } catch (error: any) {
    console.error("GET /api/lkpd/list error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil daftar LKPD" },
      { status: 500 }
    );
  }
}
