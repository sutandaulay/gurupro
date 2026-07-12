import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { grantAddonTokens } from "@/lib/token-system";
import { processSuccessPayment } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    let payload: any = {};
    try { payload = JSON.parse(body); } catch (e) { payload = {}; }

    const status = payload?.status || payload?.data?.status;
    const externalId = payload?.external_id || payload?.data?.external_id || payload?.data?.id;

    if (!externalId) {
      return NextResponse.json({ ok: true });
    }

    const txRes = await query("SELECT id, user_id, plan_id, status, amount FROM transactions WHERE external_id = $1", [externalId]);
    if (txRes.rows.length === 0) return NextResponse.json({ ok: true });
    const tx = txRes.rows[0];

    if (tx.status === "PAID" || tx.status === "ACTIVATED") return NextResponse.json({ ok: true });

    if (String(status).toLowerCase() === "paid" || String(status).toLowerCase() === "settled") {
      if (tx.plan_id && tx.plan_id.startsWith("addon:")) {
        await query("UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2", ["PAID", tx.id]);
        const addonId = tx.plan_id.split(":")[1];
        const pkgRes = await query("SELECT token_amount FROM addon_token_packages WHERE id = $1", [addonId]);
        if (pkgRes.rows.length) {
          const tokens = Number(pkgRes.rows[0].token_amount || 0);
          await grantAddonTokens(tx.user_id, tokens);
        }
      } else {
        await processSuccessPayment(externalId, "XENDIT", Number(tx.amount), false);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Xendit webhook error:", err);
    return NextResponse.json({ error: err.message || "webhook error" }, { status: 500 });
  }
}
