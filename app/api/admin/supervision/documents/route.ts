import { query } from "@/lib/db";
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

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("school_id");

    if (!schoolId) {
      return NextResponse.json({ error: "school_id wajib diisi" }, { status: 400 });
    }

    // Verify current user is kepala_sekolah, admin, or pengawas
    const userRoleRes = await query("SELECT role FROM users WHERE id = $1", [userId]);
    const userRole = userRoleRes.rows[0]?.role || "guru";

    // Pengecekan role di level lembaga (jika bukan admin utama)
    let isAuthorized = userRole === "admin";
    
    if (!isAuthorized) {
      const membershipCheck = await query(
        `SELECT imr.value
         FROM institution_members im
         JOIN institution_members_role imr ON imr.parent_id = im.id
         WHERE im.app_user_id = $1 AND im.status = 'active'
         AND (imr.value = 'kepala_sekolah' OR imr.value = 'wakasek')`,
        [userId]
      );
      if (membershipCheck.rows.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: Hanya Kepala Sekolah, Wakasek, atau Admin yang dapat mengakses dokumen supervisi." }, { status: 403 });
    }

    // Ambil dokumen guru_administrasi untuk sekolah ini beserta nama gurunya
    const docs = await query(
      `SELECT ga.id, ga.user_id, ga.tipe_dokumen, ga.judul_dokumen, ga.konten, ga.tanggal_kegiatan, ga.created_at,
              ga.semester, ga.kurikulum, ga.jenjang, ga.fase,
              u.nama_lengkap as nama_guru, u.email as email_guru
       FROM guru_administrasi ga
       JOIN users u ON ga.user_id = u.id
       WHERE ga.school_id = $1
       ORDER BY ga.created_at DESC`,
      [schoolId]
    );

    return NextResponse.json(docs.rows);
  } catch (error: any) {
    console.error("Supervision Documents GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
