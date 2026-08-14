import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { parseSessionCookie } from "@/lib/session-sign";
import { getEffectiveHiddenKeys } from "@/lib/rbac/menu-permissions";
import { UNRESTRICTED_ROLES } from "@/lib/menuConfig";

async function getUserIdAndSession() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

function getActiveInstitutionId(session: any): number | null {
  if (
    session.activeContext &&
    typeof session.activeContext === "object" &&
    Number.isFinite(session.activeContext.institutionId)
  ) {
    return session.activeContext.institutionId;
  }
  if (Number.isFinite(session.lastInstitutionId)) {
    return session.lastInstitutionId;
  }
  return null;
}

export async function GET() {
  try {
    const session = await getUserIdAndSession();
    const userId = session.id;

    // Admin platform tidak pernah dibatasi oleh konfigurasi institusi.
    const primaryRole = session.role || "guru";
    if (UNRESTRICTED_ROLES.has(primaryRole)) {
      return NextResponse.json({ institutionId: null, hiddenKeys: [] });
    }

    let institutionId = getActiveInstitutionId(session);
    if (!institutionId) {
      // Fallback: ambil institusi aktif pertama dari keanggotaan.
      const firstRes = await query(
        `SELECT institution_id FROM public.institution_members
         WHERE app_user_id = $1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      institutionId = firstRes.rows[0]?.institution_id ?? null;
    }

    if (!institutionId) {
      // Tidak ada konteks institusi → default semua tampil.
      return NextResponse.json({ institutionId: null, hiddenKeys: [] });
    }

    // Ambil role institusi user (sama dengan alur login). Fallback ke role akun.
    let roles: string[] = [];
    const memberRes = await query(
      `SELECT COALESCE(
         (SELECT array_agg(imr.value ORDER BY imr.id)
          FROM public.institution_members_role imr
          WHERE imr.parent_id = im.id),
         ARRAY[]::text[]
       ) AS institution_roles
       FROM public.institution_members im
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
       LIMIT 1`,
      [userId, institutionId]
    );

    if (memberRes.rows.length > 0) {
      roles = memberRes.rows[0].institution_roles || [];
    }
    if (roles.length === 0) {
      roles = [primaryRole];
    }
    const uniqueRoles = Array.from(new Set([...roles, primaryRole].filter(Boolean)));

    const hiddenKeys = await getEffectiveHiddenKeys(institutionId, uniqueRoles);

    return NextResponse.json({
      institutionId,
      roles: uniqueRoles,
      hiddenKeys,
    });
  } catch (error: any) {
    console.error("GET /api/user/menu-visibility error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}