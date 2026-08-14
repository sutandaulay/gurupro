import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { processSuccessPayment } from "@/lib/payments";
import { getPaymentGatewayConfig } from "@/lib/settings";
import { parseSessionCookie } from "@/lib/session-sign";

/**
 * Admin: verifikasi & aktifkan transaksi secara manual.
 * Mengecek status invoice langsung ke Xendit (by external_id), lalu
 * memanggil processSuccessPayment agar user di-upgrade + token masuk.
 *
 * Digunakan untuk transaksi yang webhook-nya terlewat (mis. invoice dibuat
 * sebelum callback_url terpasang, atau Callback URL dashboard belum di-set).
 *
 * Body: { externalId?: string, transactionId?: string }
 */
async function verifyAdmin(req: Request) {
  const cookieStore = await (await import("next/headers")).cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["admin", "super_admin", "manager"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { externalId, transactionId } = await req.json();

  if (!externalId && !transactionId) {
    return NextResponse.json({ error: "externalId atau transactionId wajib diisi" }, { status: 400 });
  }

  const txRes = await query(
    "SELECT * FROM transactions WHERE id = $1 OR external_id = $1",
    [transactionId || externalId]
  );
  if (txRes.rows.length === 0) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }
  const tx = txRes.rows[0];

  if (tx.status === "ACTIVATED") {
    return NextResponse.json({ success: true, alreadyActivated: true, message: "Transaksi sudah aktif." });
  }

  const pgConfig = await getPaymentGatewayConfig();
  let paidOnGateway = false;

  if (pgConfig.default_gateway === "xendit" && pgConfig.xendit.api_key && tx.external_id) {
    try {
      const authHeader = Buffer.from(pgConfig.xendit.api_key + ":").toString("base64");
      const res = await fetch(
        `https://api.xendit.co/v2/invoices/${encodeURIComponent(tx.external_id)}`,
        { method: "GET", headers: { Authorization: `Basic ${authHeader}` } }
      );
      if (res.ok) {
        const inv = await res.json();
        if (inv.status === "PAID" || inv.status === "SETTLED") {
          paidOnGateway = true;
        } else {
          return NextResponse.json({
            success: false,
            message: `Xendit: status invoice = ${inv.status}. Belum dibayar.`,
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({
          success: false,
          message: `Gagal cek Xendit: ${err.message || res.status}`,
        }, { status: 502 });
      }
    } catch (e: any) {
      return NextResponse.json({ success: false, message: `Error cek Xendit: ${e.message}` }, { status: 500 });
    }
  } else {
    // Gateway bukan Xendit atau tidak ada api_key: anggap sudah dibayar (verifikasi manual admin)
    paidOnGateway = true;
  }

  if (paidOnGateway) {
    const result = await processSuccessPayment(tx.external_id, "XENDIT", Number(tx.amount), false);
    if (result.success) {
      return NextResponse.json({ success: true, message: "Transaksi berhasil diaktifkan." });
    }
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: false, message: "Tidak dapat memverifikasi pembayaran." });
}

export async function POST(req: Request) {
  try {
    return await verifyAdmin(req);
  } catch (error: any) {
    console.error("[ADMIN VERIFY] Error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
