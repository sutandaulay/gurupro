import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPricingConfig } from "@/lib/settings";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const userRes = await query(
      `SELECT id, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit, 
              bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const user = userRes.rows[0];
    if (user.role !== "admin" && user.subscription_end) {
      const isExpired = new Date(user.subscription_end).getTime() - new Date().getTime() <= 0;
      if (isExpired && (user.token_limit || 0) > 0) {
        await query("UPDATE users SET token_limit = 0 WHERE id = $1", [userId]);
        user.token_limit = 0;
      }
    }

    const pricingConfig = await getPricingConfig();
    return NextResponse.json({
      ...user,
      pricingConfig
    });
  } catch (error: any) {
    console.error("Profile GET API error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat profil." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const { nama_lengkap, nama_sekolah, role, bank_name, bank_account_number, bank_account_name } = await req.json();

    if (!nama_lengkap) {
      return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
    }

    const targetRole = role || session.role || 'guru';

    await query(
      `UPDATE users 
       SET nama_lengkap = $1, nama_sekolah = $2, role = $3, 
           bank_name = $4, bank_account_number = $5, bank_account_name = $6
       WHERE id = $7`,
      [
        nama_lengkap.trim(), 
        nama_sekolah ? nama_sekolah.trim() : null, 
        targetRole, 
        bank_name ? bank_name.trim() : null,
        bank_account_number ? bank_account_number.trim() : null,
        bank_account_name ? bank_account_name.trim() : null,
        userId
      ]
    );

    // Update session cookie with the new role
    const sessionData = JSON.stringify({ id: userId, role: targetRole });
    cookieStore.set('gurupro_session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    const updatedUser = await query(
      `SELECT id, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit, 
              bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );

    const pricingConfig = await getPricingConfig();
    return NextResponse.json({
      ...updatedUser.rows[0],
      pricingConfig
    });
  } catch (error: any) {
    console.error("Profile POST API error:", error);
    return NextResponse.json({ error: error.message || "Gagal memperbarui profil." }, { status: 500 });
  }
}
