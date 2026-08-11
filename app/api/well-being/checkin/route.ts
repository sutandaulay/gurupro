import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

// Sprint 4.4 — Well-Being Check-In mingguan (independen).
// Guru isi 1-2 pertanyaan (skala beban kerja & dukungan). Data individual TIDAK di-expose
// ke pimpinan; hanya agregat anonim di well_being_weekly_summary.

function mingguKe(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const hari = d.getDay();
  const selisih = hari === 0 ? -6 : 1 - hari;
  d.setDate(d.getDate() + selisih);
  return d.toISOString().split("T")[0];
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });
    const week = mingguKe();
    const res = await query(
      `SELECT id FROM well_being_checkins WHERE teacher_id = $1 AND minggu_ke = $2 LIMIT 1`,
      [session.id, week]
    );
    return NextResponse.json({ alreadyFilled: res.rows.length > 0, week });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Gagal memuat." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) return NextResponse.json({ error: "Sesi tidak aktif." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const beban = Number(body.beban_kerja);
    const dukungan = Number(body.dukungan);
    if (![1, 2, 3, 4, 5].includes(beban) || ![1, 2, 3, 4, 5].includes(dukungan)) {
      return NextResponse.json({ error: "Jawaban tidak valid (1-5)." }, { status: 400 });
    }

    const week = mingguKe();

    // Cari institution_id guru (jika ada)
    let institutionId: number | null = null;
    try {
      const instRes = await query(
        `SELECT institution_id FROM public.institution_members
         WHERE app_user_id = $1 AND status = 'active' LIMIT 1`,
        [session.id]
      );
      institutionId = instRes.rows[0]?.institution_id ?? null;
    } catch {}

    await query(
      `INSERT INTO well_being_checkins (teacher_id, institution_id, beban_kerja, dukungan, minggu_ke)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (teacher_id, minggu_ke) DO UPDATE SET
         beban_kerja = $3, dukungan = $4, institution_id = $2`,
      [session.id, institutionId, beban, dukungan, week]
    );

    // Update agregat anonim per institusi (hanya rata-rata, tidak ada data individual)
    if (institutionId) {
      await query(
        `INSERT INTO well_being_weekly_summary (institution_id, minggu_ke, total_responden, rata_beban_kerja, rata_dukungan)
         SELECT institution_id, minggu_ke,
                COUNT(*)::integer,
                ROUND(AVG(beban_kerja)::numeric, 2),
                ROUND(AVG(dukungan)::numeric, 2)
         FROM well_being_checkins
         WHERE institution_id = $1 AND minggu_ke = $2
         GROUP BY institution_id, minggu_ke
         ON CONFLICT (institution_id, minggu_ke) DO UPDATE SET
           total_responden = EXCLUDED.total_responden,
           rata_beban_kerja = EXCLUDED.rata_beban_kerja,
           rata_dukungan = EXCLUDED.rata_dukungan`,
        [institutionId, week]
      );
    }

    return NextResponse.json({ success: true, week });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Gagal menyimpan." }, { status: 500 });
  }
}
