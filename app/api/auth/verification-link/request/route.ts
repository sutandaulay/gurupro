import { NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { sendAccountVerificationEmail } from "@/lib/notifications";
import { createVerificationToken, getAppBaseUrl, getClientIP } from "@/lib/auth-utils";

const LINK_REQUEST_MAX_PER_HOUR = 5;

export async function POST(req: Request) {
  try {
    const clientIP = getClientIP(req);
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi!" }, { status: 400 });
    }

    const userRes = await query(
      `SELECT id, email, whatsapp, nama_lengkap, email_verified, phone_verified
       FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Akun tidak ditemukan!" }, { status: 404 });
    }
    const user = userRes.rows[0];

    if (user.email_verified && user.phone_verified) {
      return NextResponse.json({ error: "Akun Anda sudah terverifikasi, silakan langsung masuk." }, { status: 400 });
    }

    const rateCheck = await pool.query(
      `SELECT COUNT(*) as c FROM payload.otp_verifications
       WHERE sent_to = $1 AND channel = 'email_link' AND created_at > NOW() - INTERVAL '1 hour'`,
      [user.email]
    );
    if (parseInt(rateCheck.rows[0]?.c || '0', 10) >= LINK_REQUEST_MAX_PER_HOUR) {
      console.warn(`[VERIFY LINK] Rate limit exceeded for ${user.email} from ${clientIP}`);
      return NextResponse.json({ error: "Terlalu banyak permintaan. Silakan coba lagi 1 jam lagi." }, { status: 429 });
    }

    const token = createVerificationToken(String(user.id));
    const verifyLink = `${getAppBaseUrl()}/api/auth/email-verify?token=${encodeURIComponent(token)}`;

    await query(
      `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
       VALUES ($1, 'email_link', $2, NOW() + INTERVAL '24 hours', 0, 'account_verification', NOW(), NOW())`,
      [token, user.email]
    );

    const result = await sendAccountVerificationEmail(user.email, user.nama_lengkap || "User GuruPRO", verifyLink);

    if (result.success) {
      return NextResponse.json({ success: true, message: "Link verifikasi telah dikirim ulang ke email Anda." });
    }
    return NextResponse.json({ error: "Gagal mengirim email verifikasi. Coba lagi nanti." }, { status: 500 });
  } catch (err) {
    console.error("Verification link request error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan sistem." }, { status: 500 });
  }
}