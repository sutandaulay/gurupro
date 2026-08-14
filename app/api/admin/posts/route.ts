import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) throw new Error("Unauthorized");
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) throw new Error("Forbidden");
}

const postSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  featured_image: z.string().optional(),
  author: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  category_id: z.number().int().optional().nullable(),
  tags: z.array(z.string()).optional(),
  published_at: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await verifyAdmin();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT p.*, c.title as category_title, c.slug as category_slug
       FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query("SELECT COUNT(*) FROM posts");
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      docs: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/admin/posts error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = postSchema.safeParse(body);

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
    const existing = await query("SELECT id FROM posts WHERE slug = $1", [slug]);
    if (existing.rows.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    const result = await query(
      `INSERT INTO posts (title, slug, excerpt, content, featured_image, author, status, category_id, tags, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.title,
        slug,
        data.excerpt || null,
        data.content || null,
        data.featured_image || null,
        data.author || "Admin",
        data.status || "draft",
        data.category_id || null,
        data.tags || [],
        data.published_at || (data.status === "published" ? new Date().toISOString() : null),
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("POST /api/admin/posts error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const data = parsed.data;

    // Generate slug if title changed
    let slug = data.slug;
    if (data.title && !slug) {
      slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    const result = await query(
      `UPDATE posts SET
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        excerpt = COALESCE($3, excerpt),
        content = COALESCE($4, content),
        featured_image = COALESCE($5, featured_image),
        author = COALESCE($6, author),
        status = COALESCE($7, status),
        category_id = COALESCE($8, category_id),
        tags = COALESCE($9, tags),
        published_at = COALESCE($10, published_at),
        updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        data.title,
        slug,
        data.excerpt,
        data.content,
        data.featured_image,
        data.author,
        data.status,
        data.category_id,
        data.tags,
        data.published_at,
        data.id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Post tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("PUT /api/admin/posts error:", error);
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

    await query("DELETE FROM posts WHERE id = $1", [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/posts error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
