import { query, logAudit } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }
  const session = JSON.parse(sessionCookie);
  return session.id;
}

export async function GET() {
  try {
    const userId = await getUserId();

    // Fetch journals where current user is the supervisor
    const journals = await query(
      `SELECT tj.*, c.nama_kelas, sb.nama_mapel, u.nama_lengkap as nama_guru, 
              (SELECT JSON_BUILD_OBJECT('catatan', js.catatan_supervisi, 'rekomendasi', js.rekomendasi, 'status', js.status_persetujuan) 
               FROM journal_supervisions js 
               WHERE js.journal_id = tj.id 
               ORDER BY js.created_at DESC LIMIT 1) as ulasan
       FROM teacher_journals tj
       JOIN classes c ON tj.class_id = c.id
       JOIN subjects sb ON tj.subject_id = sb.id
       JOIN users u ON tj.teacher_id = u.id
       WHERE tj.supervisor_id = $1
       ORDER BY tj.tanggal DESC, tj.created_at DESC`,
      [userId]
    );

    return NextResponse.json(journals.rows);
  } catch (error: any) {
    console.error("Supervision GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const { journal_id, catatan_supervisi, rekomendasi, status_persetujuan } = await req.json();

    if (!journal_id || !catatan_supervisi || !status_persetujuan) {
      return NextResponse.json({ error: "journal_id, catatan_supervisi, dan status_persetujuan wajib diisi" }, { status: 400 });
    }

    // Verify current user is supervisor of this journal
    const journalCheck = await query("SELECT supervisor_id, teacher_id FROM teacher_journals WHERE id = $1", [journal_id]);
    if (journalCheck.rows.length === 0) {
      return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
    }

    const journal = journalCheck.rows[0];
    if (journal.supervisor_id !== userId) {
      return NextResponse.json({ error: "Forbidden: Anda bukan supervisor yang ditugaskan untuk jurnal ini" }, { status: 403 });
    }

    // Map status_persetujuan ('Approved' or 'Revision') to journal status
    const targetStatus = status_persetujuan === "Approved" ? "Approved" : "Revision";

    await query("BEGIN");
    try {
      // 1. Insert supervision record
      await query(
        `INSERT INTO journal_supervisions (journal_id, supervisor_id, catatan_supervisi, rekomendasi, status_persetujuan)
         VALUES ($1, $2, $3, $4, $5)`,
        [journal_id, userId, catatan_supervisi.trim(), rekomendasi ? rekomendasi.trim() : null, status_persetujuan]
      );

      // 2. Update journal status
      await query(
        "UPDATE teacher_journals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [targetStatus, journal_id]
      );

      await query("COMMIT");
    } catch (dbErr: any) {
      await query("ROLLBACK");
      throw dbErr;
    }

    await logAudit(userId, "SUPERVISE_JOURNAL", `Memberikan ulasan supervisi [${targetStatus}] pada jurnal ID: ${journal_id}`);
    return NextResponse.json({ success: true, message: "Supervisi berhasil disimpan!" });
  } catch (error: any) {
    console.error("Supervision POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
