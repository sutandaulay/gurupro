import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateSystemSetting } from "@/lib/settings";

function parsePlanRow(row: any) {
  return {
    ...row,
    price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
    tokens: typeof row.tokens === "string" ? parseInt(row.tokens) || 0 : row.tokens || 0,
    features: typeof row.features === "string" ? JSON.parse(row.features) : row.features || [],
  };
}

async function syncPricingConfig() {
  try {
    const plans = await query(
      "SELECT * FROM pricing_plans WHERE is_active = true ORDER BY sort_order ASC"
    );
    if (plans.rows.length === 0) return;
    const config = plans.rows.map((plan: any) => ({
      id: plan.id,
      package_name: plan.package_name,
      price: typeof plan.price === "string" ? parseFloat(plan.price) : Number(plan.price),
      tokens: typeof plan.tokens === "string" ? parseInt(plan.tokens) || 0 : plan.tokens || 0,
      duration_days: plan.duration_days,
      features: typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || [],
      popular: plan.popular || false,
      sort_order: plan.sort_order || 0,
      is_active: plan.is_active !== false,
    }));
    await updateSystemSetting("pricing_config", config);
  } catch (e) {
    console.error("syncPricingConfig error:", e);
  }
}

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const session = JSON.parse(sessionCookie);
  if (session.role !== "admin") throw new Error("Forbidden");
}

const planSchema = z.object({
  id: z.string().optional(),
  package_name: z.string().min(1).max(100),
  price: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  duration_days: z.preprocess((v) => (v === "" || v === undefined || v === null ? 30 : Number(v)), z.number().int().positive()),
  tokens: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().int().min(0)).optional(),
  features: z.array(z.string()),
  is_active: z.boolean().optional(),
  popular: z.boolean().optional(),
  sort_order: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().int().optional()),
});

export async function GET() {
  try {
    await verifyAdmin();

    const result = await query(
      "SELECT * FROM pricing_plans ORDER BY sort_order ASC"
    );

    return NextResponse.json({ docs: result.rows.map(parsePlanRow) });
  } catch (error: any) {
    console.error("GET /api/admin/pricing error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = planSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    // Get max sort_order
    const maxOrder = await query("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM pricing_plans");
    const sortOrder = data.sort_order ?? maxOrder.rows[0].next_order;

    const result = await query(
      `INSERT INTO pricing_plans (package_name, price, duration_days, tokens, features, is_active, popular, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       RETURNING *`,
      [
        data.package_name,
        data.price,
        data.duration_days,
        data.tokens || 0,
        JSON.stringify(data.features),
        data.is_active ?? true,
        data.popular ?? false,
        sortOrder,
      ]
    );

    await syncPricingConfig();
    return NextResponse.json({ success: true, data: parsePlanRow(result.rows[0]) });
  } catch (error: any) {
    console.error("POST /api/admin/pricing error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = planSchema.safeParse(body);

    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const data = parsed.data;

    const result = await query(
      `UPDATE pricing_plans SET
        package_name = COALESCE($1, package_name),
        price = COALESCE($2, price),
        duration_days = COALESCE($3, duration_days),
        tokens = COALESCE($4, tokens),
        features = COALESCE($5::jsonb, features),
        is_active = COALESCE($6, is_active),
        popular = COALESCE($7, popular),
        sort_order = COALESCE($8, sort_order),
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        data.package_name,
        data.price,
        data.duration_days,
        data.tokens,
        data.features ? JSON.stringify(data.features) : null,
        data.is_active,
        data.popular,
        data.sort_order,
        data.id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
    }

    await syncPricingConfig();
    return NextResponse.json({ success: true, data: parsePlanRow(result.rows[0]) });
  } catch (error: any) {
    console.error("PUT /api/admin/pricing error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const { id, sort_order } = body;

    if (!id || sort_order === undefined) {
      return NextResponse.json({ error: "ID dan sort_order diperlukan" }, { status: 400 });
    }

    await query("UPDATE pricing_plans SET sort_order = $1, updated_at = NOW() WHERE id = $2", [sort_order, id]);
    await syncPricingConfig();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/admin/pricing error:", error);
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

    await query("DELETE FROM pricing_plans WHERE id = $1", [id]);
    await syncPricingConfig();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/pricing error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
