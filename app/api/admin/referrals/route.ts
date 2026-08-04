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
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
}

export async function GET() {
  try {
    await verifyAdmin();
    // Fetch all referrals
    const [referralsRes, totalsRes] = await Promise.all([
      query(
        `SELECT r.id, r.created_at, 
                u1.nama_lengkap AS referrer_name, u1.email AS referrer_email, u1.whatsapp AS referrer_wa, u1.cashback_balance AS referrer_balance,
                u2.nama_lengkap AS referee_name, u2.email AS referee_email,
                r.reward_tokens, r.cashback_amount
         FROM referrals r
         JOIN users u1 ON r.referrer_id = u1.id
         JOIN users u2 ON r.referee_id = u2.id
         ORDER BY r.created_at DESC
         LIMIT 100`
      ),
      query(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(r.cashback_amount), 0) AS total_cashback
         FROM referrals r`
      ),
    ]);
    const totals = totalsRes.rows[0] || { total: 0, total_cashback: 0 };
    return NextResponse.json({
      referrals: referralsRes.rows,
      total: parseInt(totals.total || "0", 10),
      total_cashback: Number(totals.total_cashback) || 0,
    });
  } catch (error: any) {
    console.error("GET admin referrals error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Reset cashback balance to 0 for this user (Payout simulated)
    const userCheck = await query("SELECT id, cashback_balance FROM users WHERE email = $1", [email]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userCheck.rows[0].id;
    const balance = userCheck.rows[0].cashback_balance;

    await query("UPDATE users SET cashback_balance = 0 WHERE id = $1", [userId]);

    // Add audit log
    await query(
      `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [null, "Pencairan Referral", `Pencairan cashback saldo Rp ${balance.toLocaleString("id-ID")} untuk user ${email}`, "127.0.0.1"]
    );

    return NextResponse.json({ success: true, message: `Pencairan cashback Rp ${balance.toLocaleString("id-ID")} sukses diproses!` });
  } catch (error: any) {
    console.error("POST admin payout error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
