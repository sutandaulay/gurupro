import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { grantAddonTokens } from "@/lib/token-system";
import { grantAddonPoin } from "@/src/services/poin-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoice_id");
    const amount = searchParams.get("amount");
    const userId = searchParams.get("userId");
    const plan = searchParams.get("plan");

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

    if (tx.plan_id && tx.plan_id.startsWith("addon:")) {
      const addonId = tx.plan_id.split(":")[1];
      const pkgRes = await query("SELECT poin_amount FROM addon_token_packages WHERE id = $1 AND is_active = true", [addonId]);
      if (pkgRes.rows.length === 0) {
        return NextResponse.json({ error: "Addon package not found" }, { status: 404 });
      }
      const poinAmount = Number(pkgRes.rows[0].poin_amount || 0);

      await query(
        "UPDATE transactions SET status = $1, payment_method = $2, updated_at = NOW() WHERE id = $3",
        ["PAID", "MOCK", invoiceId]
      );
      await grantAddonPoin(userId, poinAmount);

      return NextResponse.json({ success: true, redirect: `/dashboard?payment=success&tx=${invoiceId}` });
    }

    await query(
      "UPDATE transactions SET status = $1, payment_method = $2, updated_at = NOW() WHERE id = $3",
      ["PAID", "MOCK", invoiceId]
    );
    await grantAddonTokens(userId, Number(amount || 0));

    return NextResponse.json({ success: true, redirect: `/dashboard?payment=success&tx=${invoiceId}` });
  } catch (err: any) {
    console.error("Mock checkout error:", err);
    return NextResponse.json({ error: err.message || "Mock checkout failed" }, { status: 500 });
  }
}
