/**
 * Admin: Library Categories CRUD
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { libraryCategoryCreateSchema } from "@/lib/validations/library";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const session = JSON.parse(sessionCookie);
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) throw new Error("Forbidden");
}

export async function GET() {
  try {
    await verifyAdmin();
    const result = await query(
      "SELECT * FROM library_categories ORDER BY display_order ASC, name ASC"
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = libraryCategoryCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    const result = await query(
      `INSERT INTO library_categories (name, slug, icon, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.slug, data.icon || null, data.displayOrder ?? 0]
    );
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("POST /api/admin/library/categories error:", error);
    if (error.code === "23505") return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
