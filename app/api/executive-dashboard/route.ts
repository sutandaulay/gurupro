import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Sprint 3.3 — Baca cache dashboard eksekutif untuk Kepsek/Wakasek.
// Validasi role, lalu kembalikan payload dari executive_dashboard_cache (bukan query live).

export async function GET(req: Request) {
  try {
    const sessionCookie = req.headers.get("cookie")?.split(";")
      .find((c) => c.trim().startsWith("gurupro_session="));
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split("=")[1]));

    const url = new URL(req.url);
    const institutionId = url.searchParams.get("institutionId");

    // Cek role kepala_sekolah/wakasek
    const memberRes = await query(
      `SELECT im.institution_id, ARRAY_AGG(imr.value) AS roles
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.status = 'active'
         AND imr.value IN ('kepala_sekolah','wakasek')
       GROUP BY im.institution_id`,
      [sessionData.id]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden: bukan pimpinan institusi" }, { status: 403 });
    }

    const allowedIds = memberRes.rows.map((r: any) => r.institution_id);
    const targetId = institutionId ? Number(institutionId) : allowedIds[0];
    if (!allowedIds.includes(targetId)) {
      return NextResponse.json({ error: "Forbidden: bukan institusi Anda" }, { status: 403 });
    }

    const now = new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    const hari = d.getDay();
    const selisih = hari === 0 ? -6 : 1 - hari;
    d.setDate(d.getDate() + selisih);
    const startStr = d.toISOString().split("T")[0];

    const cacheRes = await query(
      `SELECT payload, cached_at FROM executive_dashboard_cache
       WHERE institution_id = $1 AND week_start = $2`,
      [targetId, startStr]
    );

    const institutions = await query(
      `SELECT id, name FROM institutions WHERE id = ANY($1)`,
      [allowedIds]
    );

    if (cacheRes.rows.length === 0) {
      return NextResponse.json({
        cached: false,
        dashboard: null,
        institutions: institutions.rows,
        selectedInstitutionId: targetId,
      });
    }

    return NextResponse.json({
      cached: true,
      cachedAt: cacheRes.rows[0].cached_at,
      dashboard: cacheRes.rows[0].payload,
      institutions: institutions.rows,
      selectedInstitutionId: targetId,
    });
  } catch (error: any) {
    console.error("Exec dashboard read error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
