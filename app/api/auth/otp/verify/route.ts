import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, otp, password } = await req.json();

    if (!email || !otp || !password) {
      return NextResponse.json(
        { error: "Email, Kode OTP, dan Password Baru wajib diisi!" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    // Find user and check OTP validity
    const userRes = await query(
      `SELECT id, otp_code, otp_expires_at 
       FROM users 
       WHERE LOWER(email) = $1 OR LOWER(username) = $1`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Alamat email tidak terdaftar!" }, { status: 404 });
    }

    const user = userRes.rows[0];

    // Check if OTP matches and is not expired
    if (!user.otp_code || user.otp_code !== cleanOtp) {
      return NextResponse.json({ error: "Kode OTP salah!" }, { status: 400 });
    }

    const expiresAt = new Date(user.otp_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: "Kode OTP telah kedaluwarsa!" }, { status: 400 });
    }

    // Hash the new password
    const hashed = hashPassword(password);

    // Update password and clear OTP columns
    await query(
      `UPDATE users 
       SET password_hash = $1, 
           otp_code = NULL, 
           otp_expires_at = NULL 
       WHERE id = $2`,
      [hashed, user.id]
    );

    return NextResponse.json({ 
      success: true, 
      message: "Password Anda berhasil diperbarui! Silakan masuk kembali dengan password baru." 
    });
  } catch (error: any) {
    console.error("OTP verification error:", error);
    return NextResponse.json({ error: error.message || "Gagal memverifikasi OTP" }, { status: 500 });
  }
}
