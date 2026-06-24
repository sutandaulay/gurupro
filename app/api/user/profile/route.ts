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
      `SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit, 
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

    const body = await req.json();
    const { nama_lengkap, nama_sekolah, username, bank_name, bank_account_number, bank_account_name } = body;

    if (!nama_lengkap) {
      return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
    }

    const sets: string[] = ["nama_lengkap = $1", "nama_sekolah = $2"];
    const values: (string | null)[] = [nama_lengkap.trim(), nama_sekolah ? nama_sekolah.trim() : null];
    let idx = 3;

    if (username !== undefined) {
      const cleanUsername = username && username.toString().trim() !== "" ? username.toString().trim().toLowerCase() : null;
      if (cleanUsername) {
        if (!/^[a-z0-9._-]{3,80}$/.test(cleanUsername)) {
          return NextResponse.json({ error: "Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip, minimal 3 karakter." }, { status: 400 });
        }
        const existingUsername = await query(
          "SELECT id FROM users WHERE LOWER(username) = $1 AND id <> $2",
          [cleanUsername, userId]
        );
        if (existingUsername.rows.length > 0) {
          return NextResponse.json({ error: "Username sudah digunakan pengguna lain." }, { status: 409 });
        }
      }
      sets.push(`username = $${idx}`);
      values.push(cleanUsername);
      idx++;
    }

    if (bank_name !== undefined) {
      sets.push(`bank_name = $${idx}`);
      values.push(bank_name ? bank_name.trim() : null);
      idx++;
    }
    if (bank_account_number !== undefined) {
      sets.push(`bank_account_number = $${idx}`);
      values.push(bank_account_number ? bank_account_number.trim() : null);
      idx++;
    }
    if (bank_account_name !== undefined) {
      sets.push(`bank_account_name = $${idx}`);
      values.push(bank_account_name ? bank_account_name.trim() : null);
      idx++;
    }

    const targetRole = session.role || 'guru';

    values.push(userId);
    await query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`,
      values
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
      `SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit, 
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
