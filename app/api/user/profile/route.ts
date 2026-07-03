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
              bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at,
              jenjang, mata_pelajaran, nip
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const user = userRes.rows[0];
    const pricingConfig = await getPricingConfig();

    if (user.role !== "admin" && user.subscription_end) {
      const isExpired = new Date(user.subscription_end).getTime() - new Date().getTime() <= 0;
      if (isExpired) {
        if ((user.token_limit || 0) > 0) {
          await query("UPDATE users SET token_limit = 0 WHERE id = $1", [userId]);
          user.token_limit = 0;
        }
      } else if (!user.token_limit) {
        try {
          const planKey = user.status_langganan || "free";
          const planDetails = (pricingConfig as any)[planKey];
          if (planDetails?.tokens) {
            await query("UPDATE users SET token_limit = $1 WHERE id = $2", [planDetails.tokens, userId]);
            user.token_limit = planDetails.tokens;
          }
        } catch (e) {
          console.error("Auto-initialize token_limit gagal:", e);
        }
      }
    }

    return NextResponse.json({
      ...user,
      pricingConfig
    });
  } catch (error: any) {
    console.error("Profile GET API error:", error?.stack || error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Gagal memuat profil." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const body = await req.json();
    const { action, current_password, new_password, ...profileData } = body;

    // Handle change password
    if (action === "change_password") {
      if (!current_password || !new_password) {
        return NextResponse.json({ error: "Password saat ini dan baru wajib diisi" }, { status: 400 });
      }

      if (new_password.length < 6) {
        return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
      }

      // Get user with hashed password
      const userRes = await query(
        "SELECT id, password FROM users WHERE id = $1",
        [userId]
      );

      if (userRes.rows.length === 0) {
        return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
      }

      const user = userRes.rows[0];

      // Verify current password
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(current_password, user.password);

      if (!isValid) {
        return NextResponse.json({ error: "Password saat ini salah" }, { status: 400 });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(new_password, 12);

      // Update password
      await query(
        "UPDATE users SET password = $1 WHERE id = $2",
        [hashedPassword, userId]
      );

      return NextResponse.json({ message: "Password berhasil diubah!" });
    }

    // Handle profile update
    const { nama_lengkap, nama_sekolah, username, bank_name, bank_account_number, bank_account_name, whatsapp, jenjang, mata_pelajaran, nip } = profileData;

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

    if (whatsapp !== undefined) {
      if (whatsapp) {
        // Validate WhatsApp format (digits only)
        const cleanWA = whatsapp.replace(/\D/g, "");
        if (cleanWA.length < 10) {
          return NextResponse.json({ error: "Nomor WhatsApp minimal 10 digit." }, { status: 400 });
        }
        // Check if WhatsApp is already taken
        const existingWA = await query(
          "SELECT id FROM users WHERE whatsapp = $1 AND id <> $2",
          [cleanWA, userId]
        );
        if (existingWA.rows.length > 0) {
          return NextResponse.json({ error: "Nomor WhatsApp sudah digunakan pengguna lain." }, { status: 409 });
        }
        sets.push(`whatsapp = $${idx}`);
        values.push(cleanWA);
      } else {
        sets.push(`whatsapp = $${idx}`);
        values.push(null);
      }
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
    if (jenjang !== undefined) {
      sets.push(`jenjang = $${idx}`);
      values.push(jenjang || null);
      idx++;
    }
    if (mata_pelajaran !== undefined) {
      sets.push(`mata_pelajaran = $${idx}`);
      values.push(mata_pelajaran ? mata_pelajaran.trim() : null);
      idx++;
    }
    if (nip !== undefined) {
      sets.push(`nip = $${idx}`);
      values.push(nip ? nip.trim() : null);
      idx++;
    }

    values.push(userId);
    await query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`,
      values
    );

    // Update session cookie with the new role
    const sessionData = JSON.stringify({ id: userId, role: session.role || 'guru' });
    cookieStore.set('gurupro_session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    const updatedUser = await query(
      `SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit,
              bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at,
              jenjang, mata_pelajaran, nip
       FROM users WHERE id = $1`,
      [userId]
    );

    const pricingConfig = await getPricingConfig();
    return NextResponse.json({
      message: "Profil berhasil diperbarui!",
      user: updatedUser.rows[0],
      pricingConfig
    });
  } catch (error: any) {
    console.error("Profile PUT API error:", error);
    return NextResponse.json({ error: error.message || "Gagal memperbarui profil." }, { status: 500 });
  }
}

// Keep POST for backward compatibility
export async function POST(req: Request) {
  return PUT(req);
}