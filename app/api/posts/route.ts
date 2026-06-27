import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const page = parseInt(searchParams.get("page") || "1");
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "published";
    const offset = (page - 1) * limit;

    let sql = `
      SELECT
        p.id, p.title, p.slug, p.excerpt, p.featured_image,
        p.author, p.status, p.tags, p.view_count, p.published_at,
        p.created_at, p.updated_at,
        c.id as category_id, c.title as category_title, c.slug as category_slug, c.color as category_color
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = $1
    `;
    const params: any[] = [status];

    if (category) {
      sql += ` AND (c.slug = $2 OR c.title ILIKE $2)`;
      params.push(`%${category}%`);
    }

    sql += ` ORDER BY p.published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) FROM posts p LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = $1`;
    const countParams = [status];
    if (category) {
      countSql += ` AND (c.slug = $2 OR c.title ILIKE $2)`;
      countParams.push(`%${category}%`);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      docs: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
