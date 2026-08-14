import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { suggestSubstitutes } from "@/lib/substitute-suggestion";
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

// Sprint 4.5 — Endpoint saran guru pengganti (independen).
// Dipanggil dengan leaveRequestId; membaca data member secara READ-ONLY.

export async function GET(req: Request) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const leaveId = url.searchParams.get("leaveId");
    if (!leaveId) return NextResponse.json({ error: "leaveId wajib" }, { status: 400 });

    const lr = await query(
      `SELECT teacher_id, institution_id, start_date, end_date, status
       FROM leave_requests WHERE id = $1`,
      [leaveId]
    );
    if (lr.rows.length === 0) return NextResponse.json({ error: "Leave tidak ditemukan" }, { status: 404 });

    const leave = lr.rows[0];
    if (leave.status !== "approved") {
      return NextResponse.json({ suggestions: [], message: "Leave belum disetujui" });
    }

    // Guru mandiri (sekolah mandiri) tanpa institusi: tidak ada rekan pengganti berbasis institusi
    if (!leave.institution_id) {
      return NextResponse.json({ suggestions: [], message: "Saran pengganti hanya untuk leave berbasis institusi" });
    }

    const suggestions = await suggestSubstitutes(
      Number(leave.institution_id),
      leave.teacher_id,
      leave.start_date,
      leave.end_date
    );

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("substitute suggestion error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
