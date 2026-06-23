import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;

  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const session = JSON.parse(sessionCookie);
  if (session.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export async function GET() {
  try {
    await verifyAdmin();

    const pendingPayoutsRes = await query("SELECT COUNT(*) FROM payout_requests WHERE status = 'PENDING'");
    const pendingTransactionsRes = await query("SELECT COUNT(*) FROM transactions WHERE status = 'PAID'");

    const pendingPayouts = parseInt(pendingPayoutsRes.rows[0]?.count || "0");
    const pendingTransactions = parseInt(pendingTransactionsRes.rows[0]?.count || "0");

    return NextResponse.json({
      pendingPayouts,
      pendingTransactions,
      totalNotifications: pendingPayouts + pendingTransactions
    });
  } catch (error: any) {
    console.error("Admin notifications polling error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
