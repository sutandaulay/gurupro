import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyVerificationToken } from "@/lib/auth-utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "";

  const payload = verifyVerificationToken(token);
  if (!payload) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("Link verifikasi tidak valid atau sudah kedaluwarsa."), request.url)
    );
  }

  try {
    const res = await query(
      `UPDATE users
       SET email_verified = TRUE, phone_verified = TRUE
       WHERE id = $1 AND (email_verified = FALSE OR phone_verified = FALSE)
       RETURNING id`,
      [payload.userId]
    );

    if (res.rows.length === 0) {
      return NextResponse.redirect(
        new URL("/login?error=" + encodeURIComponent("Akun Anda sudah terverifikasi, silakan langsung masuk."), request.url)
      );
    }

    return NextResponse.redirect(new URL("/login?verified=1", request.url));
  } catch (err) {
    console.error("Email verify error:", err);
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("Terjadi kesalahan saat memverifikasi akun."), request.url)
    );
  }
}