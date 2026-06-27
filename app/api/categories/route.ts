import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const sort = searchParams.get("sort") || "title";

    const result = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status = 'published') as post_count
       FROM categories c
       ORDER BY c.${sort === "post_count" ? "post_count" : "title"} ASC
       LIMIT $1`,
      [limit]
    );

    return NextResponse.json({
      docs: result.rows,
    });
  } catch (error: any) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
