import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEventNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email wajib diisi!" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find user
    const userRes = await query(
      "SELECT id, email, whatsapp, nama_lengkap FROM users WHERE email = $1",
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Alamat email tidak terdaftar!" }, { status: 404 });
    }

    const user = userRes.rows[0];

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in DB with 10 minutes expiration
    await query(
      `UPDATE users 
       SET otp_code = $1, 
           otp_expires_at = NOW() + INTERVAL '10 minutes' 
       WHERE id = $2`,
      [otp, user.id]
    );

    // Send notification
    await sendEventNotification("forgot_password", user, { otp_code: otp });

    return NextResponse.json({ 
      success: true, 
      message: "Kode OTP berhasil dikirim ke Email & WhatsApp Anda!" 
    });
  } catch (error: any) {
    console.error("OTP request error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses OTP" }, { status: 500 });
  }
}
