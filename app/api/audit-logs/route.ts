import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userRole = session.role;

    // Only allow admin, pengawas, and kepala_sekolah to read audit logs
    if (userRole !== "admin" && userRole !== "pengawas" && userRole !== "kepala_sekolah") {
      return NextResponse.json({ error: "Akses ditolak. Peran Anda tidak memiliki hak akses." }, { status: 403 });
    }

    const res = await query(
      `SELECT 
        at.id,
        at.aksi,
        at.deskripsi,
        at.ip_address,
        at.created_at,
        u.nama_lengkap,
        u.email,
        u.role
       FROM audit_trails at
       LEFT JOIN users u ON at.user_id = u.id
       ORDER BY at.created_at DESC
       LIMIT 50`
    );

    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("Audit Logs GET error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat log audit." }, { status: 500 });
  }
}
