/**
 * Admin: Library Items — Update + Delete (Archive)
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) throw new Error("Unauthorized");
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) throw new Error("Forbidden");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin();
    const { id } = await params;
    const result = await query(
      `SELECT li.*, lc.name as category_name, lc.slug as category_slug
       FROM library_items li
       JOIN library_categories lc ON lc.id = li.category_id
       WHERE li.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin();
    const { id } = await params;
    const body = await request.json();

    // Only allow updating certain fields
    const allowed = ['title', 'author', 'synopsis', 'category_id', 'status', 'page_count', 'duration_seconds'];
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of allowed) {
      const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (body[camelCase] !== undefined || body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(body[camelCase] ?? body[field]);
        idx++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Tidak ada field yang diupdate" }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE library_items SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("PATCH /api/admin/library/items/[id] error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin();
    const { id } = await params;

    // Archive instead of hard delete — keep R2 files so existing readers still work
    const item = await query("SELECT file_key, cover_image_key, type FROM library_items WHERE id = $1", [id]);
    if (item.rows.length === 0) {
      return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
    }

    await query(
      `UPDATE library_items SET status = 'archived', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/library/items/[id] error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
