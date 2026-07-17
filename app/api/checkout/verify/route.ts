import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { processSuccessPayment } from "@/lib/payments";

/**
 * Verifikasi status transaksi setelah redirect dari payment gateway.
 * Digunakan sebagai fallback apabila webhook Xendit terlambat/terlewat.
 *
 * Body: { transactionId: string }
 * transactionId = transactions.id (UUID) yang dikirim di ?payment=success&tx=
 */
export async function POST(req: Request) {
  try {
    const { transactionId } = await req.json();
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId wajib diisi" }, { status: 400 });
    }

    const txRes = await query("SELECT * FROM transactions WHERE id = $1", [transactionId]);
    if (txRes.rows.length === 0) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }
    const tx = txRes.rows[0];

    if (tx.status === "ACTIVATED") {
      return NextResponse.json({ success: true, status: "ACTIVATED", alreadyActivated: true });
    }

    // Cek status langsung ke Xendit via external_id (hanya untuk Xendit)
    const pgConfig = await (await import("@/lib/settings")).getPaymentGatewayConfig();
    let paidOnGateway = false;

    if (pgConfig.default_gateway === "xendit" && pgConfig.xendit.api_key && tx.external_id) {
      try {
        const authHeader = Buffer.from(pgConfig.xendit.api_key + ":").toString("base64");
        const res = await fetch(`https://api.xendit.co/v2/invoices/${encodeURIComponent(tx.external_id)}`, {
          method: "GET",
          headers: { Authorization: `Basic ${authHeader}` },
        });
        if (res.ok) {
          const inv = await res.json();
          if (inv.status === "PAID" || inv.status === "SETTLED") {
            paidOnGateway = true;
          }
        }
      } catch (e: any) {
        console.error("[VERIFY] Gagal cek Xendit:", e.message);
      }
    }

    if (paidOnGateway) {
      const result = await processSuccessPayment(tx.external_id, "XENDIT", Number(tx.amount), false);
      if (result.success) {
        return NextResponse.json({ success: true, status: "ACTIVATED", verified: true });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: tx.status, paidOnGateway: false });
  } catch (error: any) {
    console.error("[VERIFY] Error:", error);
    return NextResponse.json({ error: error.message || "Gagal verifikasi" }, { status: 500 });
  }
}
