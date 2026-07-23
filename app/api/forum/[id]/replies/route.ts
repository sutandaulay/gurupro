import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

// Sprint 4.6 — Ambil balasan sebuah topik forum. Keanggotaan institusi divalidasi.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.id) return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    const { id } = await params;

    const topicRes = await query(`SELECT institution_id FROM forum_topics WHERE id = $1`, [id]);
    if (topicRes.rows.length === 0) return NextResponse.json({ error: "Topik tidak ditemukan." }, { status: 404 });

    const instId = Number(topicRes.rows[0].institution_id);
    const memberRes = await query(
      `SELECT 1 FROM institution_members WHERE app_user_id = $1 AND institution_id = $2 AND status = 'active' LIMIT 1`,
      [session.id, instId]
    );
    if (memberRes.rows.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const replies = await query(
      `SELECT r.id, r.body, r.created_at, u.nama_lengkap AS author
       FROM forum_replies r JOIN users u ON u.id = r.author_id
       WHERE r.topic_id = $1 ORDER BY r.created_at ASC`,
      [id]
    );
    return NextResponse.json({ replies: replies.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Gagal memuat balasan." }, { status: 500 });
  }
}
