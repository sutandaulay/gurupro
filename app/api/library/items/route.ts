/**
 * Guru: Katalog perpustakaan — list + search
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parsePagination, wrapResponse } from "@/lib/pagination";

async function verifyGuru() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
}

export async function GET(request: Request) {
  try {
    await verifyGuru();
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";

    let where = "WHERE li.status = 'published'";
    const params: any[] = [];
    let idx = 1;

    if (search) {
      where += ` AND (li.title ILIKE $${idx} OR li.author ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (category) {
      where += ` AND lc.slug = $${idx}`;
      params.push(category);
      idx++;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM library_items li
       JOIN library_categories lc ON lc.id = li.category_id
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT li.id, li.type, li.title, li.author, li.synopsis, li.cover_image_key,
              li.page_count, li.duration_seconds, li.category_id,
              lc.name as category_name, lc.slug as category_slug
       FROM library_items li
       JOIN library_categories lc ON lc.id = li.category_id
       ${where}
       ORDER BY li.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    return NextResponse.json(wrapResponse(result.rows, total, { page, limit }));
  } catch (error: any) {
    console.error("GET /api/library/items error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
