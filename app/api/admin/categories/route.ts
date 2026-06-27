import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const session = JSON.parse(sessionCookie);
  if (session.role !== "admin") throw new Error("Forbidden");
}

const categorySchema = z.object({
  id: z.number().int().optional(),
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function GET() {
  try {
    await verifyAdmin();

    const result = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id) as post_count
       FROM categories c
       ORDER BY c.title ASC`
    );

    return NextResponse.json({ docs: result.rows });
  } catch (error: any) {
    console.error("GET /api/admin/categories error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = categorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    // Generate slug if not provided
    let slug = data.slug;
    if (!slug) {
      slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    // Check slug uniqueness
    const existing = await query("SELECT id FROM categories WHERE slug = $1", [slug]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO categories (title, slug, description, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.title, slug, data.description || null, data.color || "#4f46e5"]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("POST /api/admin/categories error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = categorySchema.safeParse(body);

    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const data = parsed.data;

    const result = await query(
      `UPDATE categories SET
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        description = COALESCE($3, description),
        color = COALESCE($4, color),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [data.title, data.slug, data.description, data.color, data.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("PUT /api/admin/categories error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await verifyAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    // Check if category has posts
    const posts = await query("SELECT COUNT(*) FROM posts WHERE category_id = $1", [id]);
    if (parseInt(posts.rows[0].count) > 0) {
      return NextResponse.json({ error: "Kategori memiliki artikel. Hapus atau pindahkan artikel terlebih dahulu." }, { status: 400 });
    }

    await query("DELETE FROM categories WHERE id = $1", [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/categories error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
