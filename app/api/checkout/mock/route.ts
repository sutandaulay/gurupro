import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { grantUserTokens, grantAddonTokens } from "@/lib/token-system";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("invoice_id");
    const userId = url.searchParams.get("userId");

    if (!invoiceId || !userId) {
      return NextResponse.json({ error: "invoice_id and userId required" }, { status: 400 });
    }

    // Find transaction
    const txRes = await query("SELECT id, plan_id, status FROM transactions WHERE id = $1", [invoiceId]);
    if (txRes.rows.length === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const tx = txRes.rows[0];

    // If already PAID or ACTIVATED, return success
    if (tx.status === "PAID" || tx.status === "ACTIVATED") {
      return NextResponse.json({ success: true, redirect: `/dashboard?payment=success&tx=${invoiceId}` });
    }

    // If addon plan
    if (tx.plan_id && tx.plan_id.startsWith("addon:")) {
      const addonId = tx.plan_id.split(":")[1];
      const pkgRes = await query("SELECT token_amount FROM addon_token_packages WHERE id = $1 AND is_active = true", [addonId]);
      if (pkgRes.rows.length === 0) {
        return NextResponse.json({ error: "Addon package not found" }, { status: 404 });
      }
      const tokens = Number(pkgRes.rows[0].token_amount || 0);

      // Mark transaction as PAID and grant addon tokens
      await query("UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2", ["PAID", invoiceId]);
      await grantAddonTokens(userId, tokens);

      return NextResponse.json({ success: true, redirect: `/dashboard?payment=success&tx=${invoiceId}` });
    }

    // Default: mark as PAID but don't grant tokens automatically for subscription purchases here
    await query("UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2", ["PAID", invoiceId]);

    return NextResponse.json({ success: true, redirect: `/dashboard?payment=success&tx=${invoiceId}` });
  } catch (err: any) {
    console.error("Mock checkout error:", err);
    return NextResponse.json({ error: err.message || "Mock checkout failed" }, { status: 500 });
  }
}
