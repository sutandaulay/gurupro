import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { query } from "@/lib/db";
import { z } from "zod";
import {
  INSTITUTION_FEATURES,
  setInstitutionFeature,
  type InstitutionFeatureKey,
} from "@/lib/feature-flags";

const BODY = z.object({
  feature_key: z.string(),
  enabled: z.boolean(),
});

async function isKepalaSekolah(appUserId: string, institutionId: number): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
       AND imr.value = 'kepala_sekolah'
     LIMIT 1`,
    [appUserId, institutionId]
  );
  return res.rows.length > 0;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });

    if (!(await isKepalaSekolah(session.id, instId))) {
      return NextResponse.json({ error: "Forbidden: hanya kepala sekolah" }, { status: 403 });
    }

    const res = await query(
      `SELECT feature_key, enabled FROM institution_feature_flags WHERE institution_id = $1`,
      [instId]
    );
    const flags = new Map<string, boolean>(
      res.rows.map((r: any) => [r.feature_key, Boolean(r.enabled)])
    );

    const features = Object.entries(INSTITUTION_FEATURES).map(([key, label]) => ({
      key,
      label,
      enabled: flags.has(key) ? flags.get(key) : false,
    }));

    return NextResponse.json({ features });
  } catch (error: any) {
    console.error("Feature flags GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });

    if (!(await isKepalaSekolah(session.id, instId))) {
      return NextResponse.json({ error: "Forbidden: hanya kepala sekolah" }, { status: 403 });
    }

    const parsed = BODY.parse(await req.json());
    if (!(parsed.feature_key in INSTITUTION_FEATURES)) {
      return NextResponse.json({ error: "Unknown feature_key" }, { status: 400 });
    }

    await setInstitutionFeature(instId, parsed.feature_key as InstitutionFeatureKey, parsed.enabled);
    return NextResponse.json({ success: true, feature_key: parsed.feature_key, enabled: parsed.enabled });
  } catch (error: any) {
    console.error("Feature flags PUT error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validasi gagal", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}