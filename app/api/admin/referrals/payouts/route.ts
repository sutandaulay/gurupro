import { query, logAudit } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendEventNotification } from "@/lib/notifications";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
}

export async function GET() {
  try {
    await verifyAdmin();

    const payoutRequests = await query(
      `SELECT pr.id, pr.tipe, pr.jumlah, pr.status, pr.catatan, pr.created_at, pr.bank_name, pr.bank_account_number, pr.bank_account_name,
              u.nama_lengkap AS user_name, u.email AS user_email, u.whatsapp AS user_wa, u.cashback_balance AS user_current_balance
       FROM payout_requests pr
       JOIN users u ON pr.user_id = u.id
       ORDER BY pr.created_at DESC
       LIMIT 100`
    );

    return NextResponse.json(payoutRequests.rows);
  } catch (error: any) {
    console.error("GET admin payouts error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();

    const { requestId, status, responseNote } = await req.json();

    if (!requestId || !status) {
      return NextResponse.json({ error: "Request ID and Status are required" }, { status: 400 });
    }

    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json({ error: "Status must be APPROVED or REJECTED" }, { status: 400 });
    }

    // Check request existence
    const requestRes = await query(
      "SELECT id, user_id, jumlah, status, bank_name, bank_account_number, bank_account_name FROM payout_requests WHERE id = $1",
      [requestId]
    );

    if (requestRes.rows.length === 0) {
      return NextResponse.json({ error: "Payout request not found" }, { status: 404 });
    }

    const request = requestRes.rows[0];

    if (request.status !== "PENDING") {
      return NextResponse.json({ error: "Request has already been processed" }, { status: 400 });
    }

    const userId = request.user_id;
    const amount = Number(request.jumlah);

    // Get user details for logging
    const userRes = await query("SELECT email, whatsapp, nama_lengkap FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "User associated with request not found" }, { status: 404 });
    }
    const userObj = userRes.rows[0];

    if (status === "APPROVED") {
      await query(
        "UPDATE payout_requests SET status = $1, catatan = $2 WHERE id = $3",
        [status, responseNote || "Disetujui oleh admin", requestId]
      );
      await logAudit(null, "Pencairan Cashback Disetujui", `Pencairan Rp ${amount.toLocaleString("id-ID")} untuk user ${userObj.email} disetujui.`);
      
      // Send notification
      await sendEventNotification("payout_approved", userObj, {
        amount: amount.toLocaleString("id-ID"),
        bank_name: request.bank_name || "",
        bank_account_number: request.bank_account_number || "",
        bank_account_name: request.bank_account_name || ""
      });
    } else {
      // Revert user cashback balance
      await query(
        "UPDATE users SET cashback_balance = cashback_balance + $1 WHERE id = $2",
        [amount, userId]
      );
      await query(
        "UPDATE payout_requests SET status = $1, catatan = $2 WHERE id = $3",
        [status, responseNote || "Ditolak oleh admin", requestId]
      );
      await logAudit(null, "Pencairan Cashback Ditolak", `Pencairan Rp ${amount.toLocaleString("id-ID")} untuk user ${userObj.email} ditolak. Saldo dikembalikan.`);
      
      // Send notification
      await sendEventNotification("payout_rejected", userObj, {
        amount: amount.toLocaleString("id-ID"),
        bank_name: request.bank_name || "",
        bank_account_number: request.bank_account_number || "",
        bank_account_name: request.bank_account_name || "",
        catatan: responseNote || "Ditolak oleh admin"
      });
    }

    return NextResponse.json({ success: true, message: `Permintaan pencairan berhasil di-${status.toLowerCase()}` });
  } catch (error: any) {
    console.error("POST admin payouts error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
