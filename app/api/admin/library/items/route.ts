/**
 * Admin: Library Items — List + Create
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { libraryItemCreateSchema } from "@/lib/validations/library";
import { parsePagination, wrapResponse } from "@/lib/pagination";
import { pdfKey, audiobookKey, coverKey } from "@/lib/r2-library";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const session = JSON.parse(sessionCookie);
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) throw new Error("Forbidden");
}

export async function GET(request: Request) {
  try {
    await verifyAdmin();
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("category");
    const status = searchParams.get("status");

    let where = "WHERE 1=1";
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      where += ` AND (li.title ILIKE $${paramIdx} OR li.author ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (categoryId) {
      where += ` AND li.category_id = $${paramIdx}`;
      params.push(categoryId);
      paramIdx++;
    }
    if (status) {
      where += ` AND li.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM library_items li ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT li.*, lc.name as category_name, lc.slug as category_slug
       FROM library_items li
       JOIN library_categories lc ON lc.id = li.category_id
       ${where}
       ORDER BY li.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    return NextResponse.json(wrapResponse(result.rows, total, { page, limit }));
  } catch (error: any) {
    console.error("GET /api/admin/library/items error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = libraryItemCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    const session = JSON.parse((await cookies()).get("gurupro_session")!.value);

    const result = await query(
      `INSERT INTO library_items
        (category_id, type, title, author, synopsis, cover_image_key, file_key, page_count, duration_seconds, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10)
       RETURNING *`,
      [
        data.categoryId,
        data.type,
        data.title,
        data.author || null,
        data.synopsis || null,
        data.coverImageKey || "",
        data.fileKey || "",
        data.pageCount || null,
        data.durationSeconds || null,
        session.id,
      ]
    );

    const created = result.rows[0];

    // Auto-generate deterministic R2 keys when not supplied
    // (keys are derived from the item id, so upload can happen after create)
    if (!data.coverImageKey || !data.fileKey) {
      const generatedCover = data.coverImageKey || coverKey(created.id);
      const generatedFile = data.fileKey || (data.type === "pdf" ? pdfKey(created.id) : audiobookKey(created.id));
      const updated = await query(
        `UPDATE library_items SET cover_image_key = $1, file_key = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
        [generatedCover, generatedFile, created.id]
      );
      created.cover_image_key = updated.rows[0].cover_image_key;
      created.file_key = updated.rows[0].file_key;
    }

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error("POST /api/admin/library/items error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
