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

export async function GET() {
  try {
    // Try database first (fast)
    try {
      const result = await query(
        'SELECT id, icon, title, description, "order" as "sortOrder", "isActive" FROM cms_features ORDER BY "order" ASC'
      );

      const features = result.rows.map((row) => ({
        id: row.id,
        icon: row.icon,
        title: row.title,
        description: row.description,
        order: row.sortOrder,
        isActive: row.isActive,
      }));

      // Update cache
      try {
        await query(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ('landing_features', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [JSON.stringify(features)]
        );
      } catch {
        // Ignore cache update error
      }

      return NextResponse.json({ docs: features });
    } catch {
      // Fallback to cache
      const cacheRes = await query(
        "SELECT key, value FROM system_settings WHERE key = 'landing_features'"
      );

      if (cacheRes.rows.length > 0) {
        try {
          const val = cacheRes.rows[0].value;
          const cached = typeof val === "string" ? JSON.parse(val) : val;
          return NextResponse.json({ docs: cached });
        } catch {
          return NextResponse.json({ docs: [] });
        }
      }

      return NextResponse.json({ docs: [] });
    }
  } catch (error: any) {
    console.error("GET features error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();
    const body = await req.json();

    const result = await query(
      `INSERT INTO cms_features (icon, title, description, "order", "isActive")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, icon, title, description, "order" as "sortOrder", "isActive"`,
      [body.icon || "IconSparkles", body.title, body.description, body.order || 0, body.isActive !== false]
    );

    // Refresh cache
    await refreshFeaturesCache();

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error("POST features error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    await verifyAdmin();
    const body = await req.json();
    const { _id, id, ...data } = body;
    const featureId = _id || id;

    if (!featureId) {
      return NextResponse.json({ error: "ID fitur diperlukan" }, { status: 400 });
    }

    await query(
      `UPDATE cms_features SET
       icon = COALESCE($1, icon),
       title = COALESCE($2, title),
       description = COALESCE($3, description),
       "order" = COALESCE($4, "order"),
       "isActive" = COALESCE($5, "isActive"),
       "updatedAt" = NOW()
       WHERE id = $6`,
      [data.icon, data.title, data.description, data.order, data.isActive, featureId]
    );

    // Refresh cache
    await refreshFeaturesCache();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT features error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await verifyAdmin();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID fitur diperlukan" }, { status: 400 });
    }

    await query("DELETE FROM cms_features WHERE id = $1", [id]);

    // Refresh cache
    await refreshFeaturesCache();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE features error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

async function refreshFeaturesCache() {
  try {
    const result = await query(
      'SELECT id, icon, title, description, "order" as "sortOrder", "isActive" FROM cms_features ORDER BY "order" ASC'
    );
    const features = result.rows.map((row) => ({
      id: row.id,
      icon: row.icon,
      title: row.title,
      description: row.description,
      order: row.sortOrder,
      isActive: row.isActive,
    }));
    await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('landing_features', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(features)]
    );
  } catch {
    // Ignore
  }
}
