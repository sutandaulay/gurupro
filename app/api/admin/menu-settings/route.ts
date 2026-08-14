import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseSessionCookie } from "@/lib/session-sign";
import { getRoleMenuSettings, saveRoleMenuSettings } from "@/lib/rbac/menu-permissions";
import {
  APP_ROLES,
  INSTITUTION_ROLES,
  UNRESTRICTED_ROLES,
  getAllFeatureKeys,
} from "@/lib/menuConfig";

const ALLOWED_ROLES = new Set([
  ...UNRESTRICTED_ROLES,
  ...INSTITUTION_ROLES.map((r) => r.value),
  ...APP_ROLES.map((r) => r.value),
]);

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

async function institutionExists(institutionId: number): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM institutions WHERE id = $1
     UNION
     SELECT 1 FROM payload.institutions WHERE id = $1
     LIMIT 1`,
    [institutionId]
  );
  return res.rows.length > 0;
}

export async function GET(req: Request) {
  try {
    await verifyAdmin();

    const { searchParams } = new URL(req.url);
    const institutionId = parseInt(searchParams.get("institutionId") || "", 10);
    const role = searchParams.get("role");

    if (!Number.isFinite(institutionId) || !role) {
      console.warn("GET /api/admin/menu-settings bad params:", searchParams.toString());
      return NextResponse.json(
        { error: "institutionId dan role wajib diisi" },
        { status: 400 }
      );
    }

    if (!(await institutionExists(institutionId))) {
      return NextResponse.json({ error: "Institusi tidak ditemukan" }, { status: 404 });
    }

    const settings = await getRoleMenuSettings(institutionId, role);
    return NextResponse.json({ institutionId, role, settings, configured: settings.length > 0 });
  } catch (error: any) {
    console.error("GET /api/admin/menu-settings error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();

    const body = await req.json();
    const institutionId = parseInt(body.institutionId, 10);
    const { role, items } = body;

    if (!Number.isFinite(institutionId) || !role || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "institutionId, role, dan items wajib diisi" },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: `Role tidak dikenal: ${role}` }, { status: 400 });
    }

    if (!(await institutionExists(institutionId))) {
      return NextResponse.json({ error: "Institusi tidak ditemukan" }, { status: 404 });
    }

    const knownKeys = new Set(getAllFeatureKeys());
    const clean = items
      .filter((item: any) => item && typeof item.featureKey === "string" && knownKeys.has(item.featureKey))
      .map((item: any) => ({
        featureKey: item.featureKey,
        visible: Boolean(item.visible),
      }));

    await saveRoleMenuSettings(institutionId, role, clean);

    return NextResponse.json({
      success: true,
      message: "Pengaturan visibilitas berhasil disimpan",
      savedCount: clean.length,
    });
  } catch (error: any) {
    console.error("POST /api/admin/menu-settings error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}