/**
 * Guru: Detail item + signed URL streaming
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getLibrarySignedUrl } from "@/lib/r2-library";

async function verifyGuru() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  return JSON.parse(sessionCookie);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyGuru();
    const { id } = await params;

    const result = await query(
      `SELECT li.*, lc.name as category_name, lc.slug as category_slug,
              lp.last_page, lp.progress_percent, lp.last_position_seconds
       FROM library_items li
       LEFT JOIN library_categories lc ON lc.id = li.category_id
       LEFT JOIN teacher_library_progress lp ON lp.item_id = li.id AND lp.teacher_id = $2
       WHERE li.id = $1`,
      [id, session.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
    }

    const item = result.rows[0];

    // Generate signed URL for the content file (using stored keys)
    const signedUrl = item.file_key ? await getLibrarySignedUrl(item.file_key, 3600, true) : null;
    const coverUrl = item.cover_image_key ? await getLibrarySignedUrl(item.cover_image_key, 86400, true) : null;

    return NextResponse.json({
      data: {
        ...item,
        file_signed_url: signedUrl,
        cover_signed_url: coverUrl,
      },
    });
  } catch (error: any) {
    console.error("GET /api/library/items/[id] error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
