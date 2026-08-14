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

function parseValue(val: any): any {
  return typeof val === "string" ? JSON.parse(val) : val;
}

async function getWhyPoints(): Promise<any[]> {
  try {
    const res = await query(
      "SELECT key, value FROM system_settings WHERE key = 'landing_why'"
    );
    if (res.rows.length > 0) {
      const parsed = parseValue(res.rows[0].value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

async function saveWhyPoints(points: any[]) {
  await query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('landing_why', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(points)]
  );
}

export async function GET() {
  try {
    // No auth required - the admin page itself is protected
    const points = await getWhyPoints();
    return NextResponse.json({ docs: points });
  } catch (error: any) {
    console.error("GET why-points error:", error);
    // Return empty docs with 200 status instead of error to not break the UI
    return NextResponse.json({ docs: [], error: "Failed to load" }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();
    const body = await req.json();
    const points = await getWhyPoints();
    const newPoint = {
      id: "wp_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      point: body.point || "Point baru...",
      order: body.order ?? points.length,
      isActive: body.isActive !== false,
    };
    points.push(newPoint);
    await saveWhyPoints(points);
    return NextResponse.json({ success: true, data: newPoint });
  } catch (error: any) {
    console.error("POST why-points error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    await verifyAdmin();
    const body = await req.json();
    const { _id, id, ...data } = body;
    const pointId = _id || id;
    if (!pointId) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }
    const points = await getWhyPoints();
    const idx = points.findIndex((p: any) => p.id === pointId);
    if (idx === -1) {
      return NextResponse.json({ error: "Point tidak ditemukan" }, { status: 404 });
    }
    points[idx] = { ...points[idx], ...data };
    await saveWhyPoints(points);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT why-points error:", error);
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
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }
    const points = await getWhyPoints();
    const filtered = points.filter((p: any) => p.id !== id);
    if (filtered.length === points.length) {
      return NextResponse.json({ error: "Point tidak ditemukan" }, { status: 404 });
    }
    await saveWhyPoints(filtered);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE why-points error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
