import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { buildDapodikWorkbook } from "@/lib/export-adapter/dapodik";
import { getSessionFromCookieHeader } from "@/lib/session-sign";

async function getSessionUser(req: Request) {
  const cookieSession = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (cookieSession?.id) {
    return { id: cookieSession.id, role: cookieSession.role || "guru" };
  }
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { id: session.user.id as string, role: (session.user as any).role || "guru" };
  }
  return null;
}

// Sprint 4.1 — Endpoint ekspor file Dapodik (Excel). MODUL TERPISAH.
// READ-ONLY ke data sumber; mengembalikan file .xlsx untuk diunduh & diimport manual.

export async function GET(req: Request) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const institutionId = parseInt(url.searchParams.get("institutionId") || "0");
    const semester = (url.searchParams.get("semester") || "ganjil") as "ganjil" | "genap";
    const tahunAjaran = url.searchParams.get("tahunAjaran") || "2025/2026";
    const version = url.searchParams.get("version") || "2025";

    if (!institutionId) return NextResponse.json({ error: "institutionId wajib" }, { status: 400 });

    // Validasi akses: admin, operator, kepala_sekolah, wakasek di institusi tsb
    const memberRes = await query(
      `SELECT imr.value FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [session.id, institutionId]
    );
    const roles = memberRes.rows.map((r: any) => r.value);
    const allowed = ["admin", "operator", "kepala_sekolah", "wakasek"].some((r) => roles.includes(r));
    if (!allowed && session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = await buildDapodikWorkbook({ institutionId, semester, tahunAjaran, version });

    const safeName = `dapodik_${institutionId}_${tahunAjaran.replace("/", "-")}_${semester}.xlsx`;
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (error: any) {
    console.error("Dapodik export error:", error);
    return NextResponse.json({ error: "Gagal mengekspor file Dapodik" }, { status: 500 });
  }
}
