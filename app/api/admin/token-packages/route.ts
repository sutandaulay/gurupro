import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

function parsePackageRow(row: any) {
  return {
    ...row,
    price: typeof row.price === "string" ? parseFloat(row.price) : Number(row.price || 0),
    token_amount: typeof row.token_amount === "string" ? parseInt(row.token_amount, 10) || 0 : Number(row.token_amount || 0),
  };
}

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const session = JSON.parse(sessionCookie);
  if (session.role !== "admin") throw new Error("Forbidden");
}

const packageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  token_amount: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().int().min(0)),
  price: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : Number(v)), z.number().min(0)),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().int().optional()),
});

export async function GET() {
  try {
    await verifyAdmin();
    const result = await query("SELECT * FROM addon_token_packages ORDER BY sort_order ASC, created_at ASC");
    return NextResponse.json({ docs: result.rows.map(parsePackageRow) });
  } catch (error: any) {
    console.error("GET /api/admin/token-packages error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = packageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;
    const maxOrder = await query("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM addon_token_packages");
    const sortOrder = data.sort_order ?? maxOrder.rows[0].next_order;

    const result = await query(
      `INSERT INTO addon_token_packages (name, token_amount, price, description, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.name, data.token_amount || 0, data.price || 0, data.description || null, data.is_active ?? true, sortOrder]
    );

    return NextResponse.json({ success: true, data: parsePackageRow(result.rows[0]) });
  } catch (error: any) {
    console.error("POST /api/admin/token-packages error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const parsed = packageSchema.safeParse(body);

    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const data = parsed.data;
    const result = await query(
      `UPDATE addon_token_packages SET
        name = COALESCE($1, name),
        token_amount = COALESCE($2, token_amount),
        price = COALESCE($3, price),
        description = COALESCE($4, description),
        is_active = COALESCE($5, is_active),
        sort_order = COALESCE($6, sort_order)
       WHERE id = $7
       RETURNING *`,
      [data.name, data.token_amount, data.price, data.description ?? null, data.is_active, data.sort_order, data.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: parsePackageRow(result.rows[0]) });
  } catch (error: any) {
    console.error("PUT /api/admin/token-packages error:", error);
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

    await query("DELETE FROM addon_token_packages WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/token-packages error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
