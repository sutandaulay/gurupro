import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPricingConfig, getActivePricingPlans } from "@/lib/settings";
import { getUserAccountMode, getUserActiveMemberships } from "@/lib/institution-members";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { setDefaultSessionCookie } from "@/lib/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    let sessionCookie = cookieStore.get("gurupro_session")?.value;

    // Jika cookie gurupro_session tidak ada, coba sync dari NextAuth session
    if (!sessionCookie) {
      const nextAuthSession = await getServerSession(authOptions);
      if (nextAuthSession?.user?.email) {
        const userRes = await query(
          "SELECT id, role FROM users WHERE email = $1",
          [nextAuthSession.user.email.toLowerCase()]
        );
        if (userRes.rows.length > 0) {
          const user = userRes.rows[0];
          await setDefaultSessionCookie({
            id: user.id,
            role: user.role || "guru",
          });
          // Re-read the cookie we just set
          sessionCookie = (await cookies()).get("gurupro_session")?.value;
        }
      }
    }

    if (!sessionCookie) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const userRes = await query(
      `SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit, addon_token_balance,
               bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at, photo_url
        FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const user = userRes.rows[0];
    const [pricingConfig, pricingPlans] = await Promise.all([
      getPricingConfig(),
      getActivePricingPlans(),
    ]);

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

    const accountMode = await getUserAccountMode(userId);
    const memberships = await getUserActiveMemberships(userId);
    const institutionIds = memberships.map((m) => m.institution_id);
    let institutions: { id: number; name: string }[] = [];
    if (institutionIds.length > 0) {
      const instRes = await query(
        'SELECT id, name FROM institutions WHERE id = ANY($1::int[])',
        [institutionIds]
      );
      institutions = instRes.rows;
    }

    let userRole = user.role;
    if (session.activeContext && typeof session.activeContext === 'object' && session.activeContext.institutionId) {
      const instId = session.activeContext.institutionId;
      const memberRoleRes = await query(
        `SELECT imr.value
         FROM institution_members im
         JOIN institution_members_role imr ON imr.parent_id = im.id
         WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         LIMIT 1`,
        [userId, instId]
      );
      if (memberRoleRes.rows.length > 0) {
        userRole = memberRoleRes.rows[0].value;
      }
    }

    return NextResponse.json({
      ...user,
      role: userRole, // Override dengan role lembaga jika konteks lembaga aktif
      pricingConfig,
      pricingPlans,
      accountMode,
      activeContext: session.activeContext ?? 'individual',
      institutions,
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
    const { nama_lengkap, username, bank_name, bank_account_number, bank_account_name, whatsapp, nip } = profileData;

    if (!nama_lengkap) {
      return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
    }

    const sets: string[] = ["nama_lengkap = $1"];
    const values: (string | null)[] = [nama_lengkap.trim()];
    let idx = 2;

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


    values.push(userId);
    await query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`,
      values
    );

    // Update session cookie with the new role (preserve activeContext)
    const sessionData = JSON.stringify({
      id: userId,
      role: session.role || 'guru',
      activeContext: session.activeContext ?? 'individual',
    });
    cookieStore.set('gurupro_session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    const updatedUser = await query(
      `SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit, addon_token_balance,
               bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at, photo_url
        FROM users WHERE id = $1`,
      [userId]
    );

    const [pricingConfig, pricingPlans] = await Promise.all([
      getPricingConfig(),
      getActivePricingPlans(),
    ]);
    return NextResponse.json({
      message: "Profil berhasil diperbarui!",
      user: updatedUser.rows[0],
      pricingConfig,
      pricingPlans,
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