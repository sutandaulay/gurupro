/**
 * Guru: Update progress perpustakaan
 * Dipanggil berkala (debounced) saat guru membaca/mendengarkan.
 * Handle completion trigger + anti-abuse di sini.
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { progressUpdateSchema } from "@/lib/validations/library";
import { handleProgressUpdate } from "@/lib/library/complete-item";

async function verifyGuru() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const session = JSON.parse(sessionCookie);
  return session;
}

export async function GET(request: Request) {
  try {
    const session = await verifyGuru();
    const teacherId = session.id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "sedang_berjalan";

    let whereClause = "WHERE tlp.teacher_id = $1";
    if (status === "sedang_berjalan") {
      whereClause += " AND tlp.status = 'sedang_berjalan'";
    } else if (status === "selesai") {
      whereClause += " AND tlp.status = 'selesai'";
    }

    const result = await query(
      `SELECT tlp.*, li.title, li.type, li.cover_image_key, li.page_count, li.duration_seconds
       FROM teacher_library_progress tlp
       JOIN library_items li ON li.id = tlp.item_id
       ${whereClause}
       ORDER BY tlp.updated_at DESC
       LIMIT 20`,
      [teacherId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error("GET /api/library/progress error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyGuru();
    const teacherId = session.id;
    const body = await request.json();
    const parsed = progressUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }
    const { itemId, progressPercent, lastPositionSeconds, lastPage, deltaActiveSeconds } = parsed.data;

    // Guard: check item exists before upsert (prevents FK violation from orphan records)
    const itemCheck = await query(
      `SELECT id FROM library_items WHERE id = $1`,
      [itemId]
    );
    if (itemCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Item sudah tidak tersedia' }, { status: 404 });
    }

    // Get current progress
    const existing = await query(
      `SELECT * FROM teacher_library_progress WHERE teacher_id = $1 AND item_id = $2`,
      [teacherId, itemId]
    );
    const wasCompleted = existing.rows.length > 0 && existing.rows[0].status === 'selesai';

    // Upsert progress
    const now = new Date();
    let newStatus: 'belum_dimulai' | 'sedang_berjalan' | 'selesai' = 'sedang_berjalan';
    if (progressPercent >= 90) newStatus = 'selesai';

    const completedAt = newStatus === 'selesai' && !wasCompleted ? now : null;

    await query(
      `INSERT INTO teacher_library_progress
        (teacher_id, item_id, progress_percent, last_position_seconds, last_page, status, active_reading_seconds, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (teacher_id, item_id)
       DO UPDATE SET
         progress_percent = EXCLUDED.progress_percent,
         last_position_seconds = COALESCE($4, teacher_library_progress.last_position_seconds),
         last_page = COALESCE($5, teacher_library_progress.last_page),
         status = CASE WHEN EXCLUDED.status = 'selesai' THEN 'selesai' ELSE teacher_library_progress.status END,
         active_reading_seconds = teacher_library_progress.active_reading_seconds + $7,
         completed_at = COALESCE(teacher_library_progress.completed_at, EXCLUDED.completed_at),
         updated_at = NOW()`,
      [
        teacherId, itemId, progressPercent,
        lastPositionSeconds ?? null,
        lastPage ?? null,
        newStatus,
        deltaActiveSeconds ?? 0,
        completedAt,
        now,
      ]
    );

    // Trigger completion logic (poin reward + kinerja score)
    if (newStatus === 'selesai' && !wasCompleted) {
      await handleProgressUpdate(teacherId, itemId, progressPercent);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/library/progress error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
