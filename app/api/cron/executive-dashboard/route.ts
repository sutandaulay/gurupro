import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildExecDashboard } from "@/lib/executive-dashboard";

// Sprint 3.3 — Cron refresh cache dashboard eksekutif (jalankan tiap 15-30 menit).
// Membaca data READ-ONLY lalu menyimpan ke executive_dashboard_cache.
// Dashboard Kepsek membaca dari cache -> DB tidak kebeban saat banyak akses bersamaan.

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const startStr = (() => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const hari = d.getDay();
      const selisih = hari === 0 ? -6 : 1 - hari;
      d.setDate(d.getDate() + selisih);
      return d.toISOString().split("T")[0];
    })();

    // Semua institusi yang punya member kepala_sekolah/wakasek aktif
    const instRes = await query(
      `SELECT DISTINCT im.institution_id AS id
       FROM institution_members im
       JOIN institution_members_role imr ON imr.parent_id = im.id
       WHERE im.status = 'active'
         AND imr.value IN ('kepala_sekolah','wakasek')`
    );

    let refreshed = 0;
    let errors = 0;
    for (const inst of instRes.rows) {
      try {
        const payload = await buildExecDashboard(Number(inst.id), now);
        await query(
          `INSERT INTO executive_dashboard_cache (institution_id, week_start, payload)
           VALUES ($1, $2, $3)
           ON CONFLICT (institution_id, week_start)
           DO UPDATE SET payload = $3, cached_at = CURRENT_TIMESTAMP`,
          [inst.id, startStr, JSON.stringify(payload)]
        );
        refreshed++;
      } catch (err: any) {
        console.error(`[ExecDashboard] error inst ${inst.id}:`, err.message);
        errors++;
      }
    }

    return NextResponse.json({ success: true, refreshed, errors, checked: instRes.rows.length, currentTime: now.toISOString() });
  } catch (error: any) {
    console.error("Exec dashboard cron error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
