import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPricingConfig } from "@/lib/settings";
import { sendEventNotification } from "@/lib/notifications";
import { activateTransaction } from "@/lib/payments";

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

export async function GET(req: Request) {
  try {
    await verifyAdmin();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    let txQuery = `
      SELECT t.id, t.user_id, t.external_id, t.amount, t.status, t.payment_method, t.created_at, t.plan_id, 
             u.email, u.nama_lengkap 
      FROM transactions t
      JOIN users u ON t.user_id = u.id
    `;
    const params: any[] = [];

    if (q) {
      txQuery += `
        WHERE u.email ILIKE $1 
           OR u.nama_lengkap ILIKE $1 
           OR t.id ILIKE $1
           OR t.external_id ILIKE $1
      `;
      params.push(`%${q}%`);
    }

    txQuery += " ORDER BY t.created_at DESC";

    const txRes = await query(txQuery, params);
    return NextResponse.json(txRes.rows);
  } catch (error: any) {
    console.error("Admin Transactions GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();

    const { transactionId, action } = await req.json();

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }

    // Retrieve transaction
    const txRes = await query("SELECT * FROM transactions WHERE id = $1", [transactionId]);
    if (txRes.rows.length === 0) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    const transaction = txRes.rows[0];

    if (action === "activate") {
      if (transaction.status !== "PAID") {
        return NextResponse.json({ error: "Hanya transaksi berstatus PAID yang dapat diaktifkan" }, { status: 400 });
      }

      const res = await activateTransaction(transactionId);
      if (!res.success) {
        return NextResponse.json({ error: "Gagal mengaktifkan paket" }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Paket berhasil diaktifkan untuk pengguna." });
    } else {
      // Default: refund action
      if (transaction.status !== "ACTIVATED" && transaction.status !== "PAID") {
        return NextResponse.json({ error: "Hanya transaksi berstatus PAID atau ACTIVATED yang dapat direfund" }, { status: 400 });
      }

      const userId = transaction.user_id;
      const planKey = transaction.plan_id || "three_month";
      const pricingConfig = await getPricingConfig();
      
      let planDetails = (pricingConfig as any)[planKey];
      if (!planDetails) {
        const amount = Number(transaction.amount);
        if (amount >= 400000) {
          planDetails = pricingConfig.one_year;
        } else if (amount >= 220000) {
          planDetails = pricingConfig.six_month;
        } else {
          planDetails = pricingConfig.three_month;
        }
      }

      const tokensToDeduct = planDetails.tokens;

      // Update transaction status to REFUNDED
      await query("UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2", ["REFUNDED", transactionId]);

      // Deduct tokens from user and downgrade subscription status to free if it was activated
      if (transaction.status === "ACTIVATED") {
        await query(
          `UPDATE users 
           SET token_limit = GREATEST(0, COALESCE(token_limit, 0) - $1), 
               status_langganan = $2 
           WHERE id = $3`,
          [tokensToDeduct, "free", userId]
        );
      }

      return NextResponse.json({ success: true, message: "Transaksi berhasil direfund." });
    }
  } catch (error: any) {
    console.error("Admin Transactions POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
