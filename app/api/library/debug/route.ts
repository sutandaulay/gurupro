import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id needed" }, { status: 400 });

  const items = await query(`SELECT id, title, status, file_key FROM library_items LIMIT 50`);
  const target = await query(`SELECT id, title, status, file_key FROM library_items WHERE id = $1`, [id]);
  const progress = await query(`SELECT item_id, teacher_id FROM teacher_library_progress LIMIT 20`);

  return NextResponse.json({
    total_items: items.rows.length,
    all_ids: items.rows.map(r => r.id),
    target: target.rows,
    target_count: target.rows.length,
    progress_items: progress.rows.map(r => ({ item_id: r.item_id, teacher_id: r.teacher_id })),
  });
}
