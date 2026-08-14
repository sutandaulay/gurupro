import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function GET() {
  try {
    await verifyAdmin();

    const result = await query(
      `SELECT 
         pra.id,
         pra.admin_user_id,
         u.username AS admin_username,
         u.nama_lengkap AS admin_nama,
         pra.old_ratio,
         pra.new_ratio,
         pra.note,
         pra.changed_at
       FROM poin_ratio_audit pra
       LEFT JOIN users u ON u.id = pra.admin_user_id
       ORDER BY pra.changed_at DESC
       LIMIT 100`,
      []
    );

    const audits = result.rows.map((row: any) => ({
      id: row.id,
      admin_user_id: row.admin_user_id,
      admin_username: row.admin_username || "System",
      admin_nama: row.admin_nama || "System",
      old_ratio: Number(row.old_ratio),
      new_ratio: Number(row.new_ratio),
      note: row.note,
      changed_at: row.changed_at,
    }));

    return NextResponse.json({ audits });
  } catch (error: any) {
    console.error("GET poin-ratio-audit error:", error);
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
