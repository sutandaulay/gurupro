import { query, pool } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEventNotification } from "@/lib/notifications";
import { normalizePhoneNumber } from "@/lib/performance-share";
import { getClientIP, generateSecureOTP } from "@/lib/auth-utils";
import * as crypto from "crypto";

// Rate limiting constants
const OTP_REQUEST_MAX_PER_HOUR = 5;
const OTP_REQUEST_WINDOW_HOURS = 1;

export async function POST(req: Request) {
  try {
    const clientIP = getClientIP(req);
    const { email, login, purpose = 'password_reset' } = await req.json();
    const loginId = (login || email || "").toString().trim();

    if (!loginId) {
      return NextResponse.json({ error: "Email, nomor WhatsApp, atau username wajib diisi!" }, { status: 400 });
    }

    const cleanLogin = loginId.toLowerCase();
    const cleanPhone = normalizePhoneNumber(loginId) || loginId;

    // Find user
    const userRes = await query(
      `SELECT id, email, whatsapp, nama_lengkap
       FROM users
       WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR whatsapp = $2 OR whatsapp = $1`,
      [cleanLogin, cleanPhone]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Akun dengan email/WhatsApp tersebut tidak ditemukan!" }, { status: 404 });
    }

    const user = userRes.rows[0];

    // ============================================
    // RATE LIMITING: Check recent OTP requests
    // ============================================
    const rateCheck = await pool.query(`
      SELECT COUNT(*) as request_count
      FROM payload.otp_verifications
      WHERE sent_to = $1
        AND purpose = $2
        AND created_at > NOW() - INTERVAL '${OTP_REQUEST_WINDOW_HOURS} hour'
    `, [user.whatsapp || user.email, purpose]);

    const requestCount = parseInt(rateCheck.rows[0]?.request_count || '0');

    if (requestCount >= OTP_REQUEST_MAX_PER_HOUR) {
      console.warn(`[OTP] Rate limit exceeded for ${user.whatsapp || user.email} from ${clientIP}: ${requestCount} requests in last ${OTP_REQUEST_WINDOW_HOURS} hour(s)`);
      return NextResponse.json({
        error: `Terlalu banyak permintaan OTP. Silakan coba lagi dalam ${OTP_REQUEST_WINDOW_HOURS} jam.`,
        retryAfter: OTP_REQUEST_WINDOW_HOURS * 60 * 60
      }, { status: 429 });
    }

    console.log(`[OTP] Request ${requestCount + 1}/${OTP_REQUEST_MAX_PER_HOUR} for ${user.whatsapp || user.email} from ${clientIP}`);

    // Generate secure 6-digit OTP using crypto.randomInt()
    const otp = generateSecureOTP();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    // Insert OTP verification record into payload schema
    await query(
      `INSERT INTO payload.otp_verifications (
         otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at
       )
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, $4, NOW(), NOW())`,
      [otpHash, 'whatsapp', user.whatsapp || user.email, purpose]
    );

    // Send notification (Email + WhatsApp)
    await sendEventNotification("forgot_password", user, { otp_code: otp });

    const remainingRequests = Math.max(0, OTP_REQUEST_MAX_PER_HOUR - 1 - requestCount);
    return NextResponse.json({
      success: true,
      message: `Kode OTP berhasil dikirim ke WhatsApp/Email terdaftar Anda!`,
      remainingRequests
    });
  } catch (error: any) {
    console.error("OTP request error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses OTP" }, { status: 500 });
  }
}
