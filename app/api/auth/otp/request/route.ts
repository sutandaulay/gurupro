import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEventNotification } from "@/lib/notifications";
import { normalizePhoneNumber } from "@/lib/performance-share";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
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

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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

    return NextResponse.json({ 
      success: true, 
      message: `Kode OTP berhasil dikirim ke WhatsApp/Email terdaftar Anda!` 
    });
  } catch (error: any) {
    console.error("OTP request error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses OTP" }, { status: 500 });
  }
}
