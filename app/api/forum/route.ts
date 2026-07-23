import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

// Sprint 4.6 — Forum/Komunitas Guru (per-mapel, privat per-institusi).
// Anggota institusi yg sama bisa buat topik per mapel & membalas.
// Validasi: user harus anggota aktif di institution_id yang diminta.

async function listInstitusiUser(userId: string): Promise<number[]> {
  const res = await query(
    `SELECT DISTINCT institution_id FROM institution_members
     WHERE app_user_id = $1 AND status = 'active'`,
    [userId]
  );
  return res.rows.map((r: any) => Number(r.institution_id));
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") || "institution"; // "institution" | "all"
    const institutionId = parseInt(url.searchParams.get("institutionId") || "0");
    const mapel = url.searchParams.get("mapel") || "";

    const myInstitutions = await listInstitusiUser(session.id);

    // Scope lintas institusi: tampilkan topik dari semua sekolah tempat user jadi anggota.
    if (scope === "all") {
      if (myInstitutions.length === 0) {
        return NextResponse.json({ topics: [] });
      }
      const topics = await query(
        `SELECT t.id, t.institution_id, t.mapel, t.title, t.body, t.created_at,
                u.nama_lengkap AS author,
                (SELECT COUNT(*) FROM forum_replies r WHERE r.topic_id = t.id)::int AS reply_count
         FROM forum_topics t
         JOIN users u ON u.id = t.author_id
         WHERE t.institution_id = ANY($1) AND ($2 = '' OR t.mapel = $2)
         ORDER BY t.created_at DESC
         LIMIT 50`,
        [myInstitutions, mapel]
      );
      return NextResponse.json({ topics: topics.rows, scope: "all" });
    }

    // Scope per-institusi (default): validasi keanggotaan dulu.
    if (!myInstitutions.includes(institutionId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const topics = await query(
      `SELECT t.id, t.mapel, t.title, t.body, t.created_at, u.nama_lengkap AS author,
              (SELECT COUNT(*) FROM forum_replies r WHERE r.topic_id = t.id)::int AS reply_count
       FROM forum_topics t
       JOIN users u ON u.id = t.author_id
       WHERE t.institution_id = $1 AND ($2 = '' OR t.mapel = $2)
       ORDER BY t.created_at DESC
       LIMIT 50`,
      [institutionId, mapel]
    );

    return NextResponse.json({ topics: topics.rows, scope: "institution" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Gagal memuat forum." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const institutionId = parseInt(body.institutionId);
    const mapel = (body.mapel || "").toString().trim();
    const title = (body.title || "").toString().trim();
    const topicBody = (body.body || "").toString().trim();

    // Tentukan institusi target: pakai yang dikirim & valid, atau institusi pertama user.
    const myInstitutions = await listInstitusiUser(session.id);
    const targetInstitutionId = myInstitutions.includes(institutionId) ? institutionId : myInstitutions[0];

    if (!targetInstitutionId || !mapel || !title || !topicBody) {
      return NextResponse.json({ error: "Mapel, judul, dan isi wajib diisi." }, { status: 400 });
    }

    // Jika ini balasan ke topik
    if (body.topicId) {
      const tRes = await query(`SELECT id, institution_id FROM forum_topics WHERE id = $1`, [body.topicId]);
      if (tRes.rows.length === 0) return NextResponse.json({ error: "Topik tidak ditemukan." }, { status: 404 });
      if (!myInstitutions.includes(Number(tRes.rows[0].institution_id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const r = await query(
        `INSERT INTO forum_replies (topic_id, author_id, body) VALUES ($1, $2, $3) RETURNING id`,
        [body.topicId, session.id, topicBody]
      );
      return NextResponse.json({ success: true, replyId: r.rows[0].id });
    }

    // Topik baru
    const t = await query(
      `INSERT INTO forum_topics (institution_id, mapel, author_id, title, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [targetInstitutionId, mapel, session.id, title, topicBody]
    );
    return NextResponse.json({ success: true, topicId: t.rows[0].id });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Gagal memposting." }, { status: 500 });
  }
}
