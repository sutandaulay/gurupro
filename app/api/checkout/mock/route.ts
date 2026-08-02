import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { processSuccessPayment } from "@/lib/payments";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoice_id");
    const userId = searchParams.get("userId");

    if (!invoiceId || !userId) {
      return NextResponse.json({ error: "Missing invoice_id or userId" }, { status: 400 });
    }

    const txRes = await query(
      "SELECT id, user_id, plan_id, status, amount FROM transactions WHERE id = $1",
      [invoiceId]
    );
    if (txRes.rows.length === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const tx = txRes.rows[0];
    if (tx.status === "PAID" || tx.status === "ACTIVATED") {
      return NextResponse.json({ success: true, redirect: `/dashboard?payment=success&tx=${invoiceId}` });
    }

    await query(
      "UPDATE transactions SET status = $1, payment_method = $2, updated_at = NOW() WHERE id = $3",
      ["PAID", "MOCK", invoiceId]
    );

    // Delegate all activation logic (addon & regular) to processSuccessPayment
    const result = await processSuccessPayment(invoiceId, "MOCK", 0, true);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, redirect: `/dashboard?payment=success&tx=${invoiceId}` });
  } catch (err: any) {
    console.error("Mock checkout error:", err);
    return NextResponse.json({ error: err.message || "Mock checkout failed" }, { status: 500 });
  }
}
