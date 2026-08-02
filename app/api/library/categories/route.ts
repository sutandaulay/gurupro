/**
 * Guru: List kategori perpustakaan
 */

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifyGuru() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
}

export async function GET() {
  try {
    await verifyGuru();
    const result = await query(
      `SELECT lc.*,
        (SELECT COUNT(*) FROM library_items li WHERE li.category_id = lc.id AND li.status = 'published') as item_count
       FROM library_categories lc
       ORDER BY lc.display_order ASC, lc.name ASC`
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
