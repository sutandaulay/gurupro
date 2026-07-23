import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActivePricingPlans } from "@/lib/settings";
import { getUserAccountMode, getUserActiveMemberships } from "@/lib/institution-members";
import { SessionData, getSession, setDefaultSessionCookie } from "@/lib/session";

// Fungsi helper untuk sinkronisasi dari NextAuth jika diperlukan
async function syncFromNextAuth(): Promise<boolean> {
  try {
    // Dinamically import next-auth untuk menghindari error jika tidak tersedia
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth.config");
    
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
        return true;
      }
    }
  } catch (error) {
    console.warn("NextAuth not available or error occurred:", error);
    // Jika next-auth tidak tersedia atau error, abaikan dan kembalikan false
  }
  return false;
}

export async function GET() {
  try {
    // Gunakan fungsi getSession dari session.ts sebagai gantinya
    const session = await getSession();
    
    if (!session?.id) {
      // Coba sinkronisasi dari NextAuth jika session tidak ditemukan
      const synced = await syncFromNextAuth();
      if (!synced) {
        return NextResponse.json({ error: "Sesi tidak aktif. Silakan login." }, { status: 401 });
      }
      
      // Coba ambil session lagi setelah sinkronisasi
      const newSession = await getSession();
      if (!newSession?.id) {
        return NextResponse.json({ error: "Sesi tidak aktif. Silakan login." }, { status: 401 });
      }
      
      // Gunakan session yang baru
      const userId = newSession.id;

      const userRes = await query(
      `SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit, addon_token_balance,
                 bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at, photo_url, notification_tone
          FROM users WHERE id = $1`,
        [userId]
      );

      // Jika user tidak ditemukan
      if (userRes.rows.length === 0) {
        return NextResponse.json({ error: "Sesi tidak aktif. Silakan login." }, { status: 401 });
      }

      const user = userRes.rows[0];
      const [pricingConfig, pricingPlans] = await Promise.all([
        getActivePricingPlans(),
        getActivePricingPlans(),
      ]);

      // Tambahkan informasi membership dan akun
      const [memberships, accountMode] = await Promise.allSettled([
        getUserActiveMemberships(userId),
        getUserAccountMode(userId),
      ]).then(results => [
        results[0].status === 'fulfilled' ? results[0].value : [],
        results[1].status === 'fulfilled' ? results[1].value : 'personal',
      ]);

      // Ambil sekolah aktif dari session
      let activeSchool = null;
      try {
        const cookieStore = await cookies();
        const schoolId = cookieStore.get("gurupro_school_selected")?.value;
        if (schoolId) {
          const schoolRes = await query(
            "SELECT id, nama_sekolah, npsn, alamat_sekolah FROM schools WHERE id = $1",
            [schoolId]
          );
          if (schoolRes.rows.length > 0) {
            activeSchool = schoolRes.rows[0];
          }
        }
      } catch (e) {
        console.warn("Could not fetch active school:", e);
      }

      // Gabungkan data profil pengguna
      const profileData = {
        id: user.id,
        username: user.username,
        email: user.email,
        whatsapp: user.whatsapp,
        nama_lengkap: user.nama_lengkap,
        nama_sekolah: user.nama_sekolah,
        role: user.role,
        status_langganan: user.status_langganan,
        token_limit: user.token_limit || 0,
        addon_token_balance: user.addon_token_balance || 0,
        bank_name: user.bank_name,
        bank_account_number: user.bank_account_number,
        bank_account_name: user.bank_account_name,
        subscription_start: user.subscription_start,
        subscription_end: user.subscription_end,
        created_at: user.created_at,
        photo_url: user.photo_url,
      notification_tone: user.notification_tone || "hangat",
      morning_briefing_enabled: user.morning_briefing_enabled !== false,
        morning_briefing_enabled: user.morning_briefing_enabled !== false,
        weekly_recap_enabled: user.weekly_recap_enabled !== false,
        activeSchool: activeSchool,
        memberships: memberships,
        accountMode: accountMode,
        pricingConfig: pricingConfig,
        pricingPlans: pricingPlans,
      };

      return NextResponse.json(profileData);
    }

    // Jika session ditemukan langsung dari getSession()
    const userId = session.id;

    const userRes = await query(
      `SELECT id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan, token_limit, addon_token_balance,
                bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at, photo_url, notification_tone
        FROM users WHERE id = $1`,
      [userId]
    );

    // Jika user tidak ditemukan
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login." }, { status: 401 });
    }

    const user = userRes.rows[0];
    const [pricingConfig, pricingPlans] = await Promise.all([
      getActivePricingPlans(),
      getActivePricingPlans(),
    ]);

    // Tambahkan informasi membership dan akun
    const [memberships, accountMode] = await Promise.allSettled([
      getUserActiveMemberships(userId),
      getUserAccountMode(userId),
    ]).then(results => [
      results[0].status === 'fulfilled' ? results[0].value : [],
      results[1].status === 'fulfilled' ? results[1].value : 'personal',
    ]);

    // Ambil sekolah aktif dari session
    let activeSchool = null;
    try {
      const cookieStore = await cookies();
      const schoolId = cookieStore.get("gurupro_school_selected")?.value;
      if (schoolId) {
        const schoolRes = await query(
          "SELECT id, nama_sekolah, npsn, alamat_sekolah FROM schools WHERE id = $1",
          [schoolId]
        );
        if (schoolRes.rows.length > 0) {
          activeSchool = schoolRes.rows[0];
        }
      }
    } catch (e) {
      console.warn("Could not fetch active school:", e);
    }

    // Gabungkan data profil pengguna
    const profileData = {
      id: user.id,
      username: user.username,
      email: user.email,
      whatsapp: user.whatsapp,
      nama_lengkap: user.nama_lengkap,
      nama_sekolah: user.nama_sekolah,
      role: user.role,
      status_langganan: user.status_langganan,
      token_limit: user.token_limit || 0,
      addon_token_balance: user.addon_token_balance || 0,
      bank_name: user.bank_name,
      bank_account_number: user.bank_account_number,
      bank_account_name: user.bank_account_name,
      subscription_start: user.subscription_start,
      subscription_end: user.subscription_end,
      created_at: user.created_at,
      photo_url: user.photo_url,
      notification_tone: user.notification_tone || "hangat",
      activeSchool: activeSchool,
      memberships: memberships,
      accountMode: accountMode,
      pricingConfig: pricingConfig,
      pricingPlans: pricingPlans,
    };

    return NextResponse.json(profileData);
  } catch (error: any) {
    console.error("Error getting user profile:", error);
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
    const { nama_lengkap, username, bank_name, bank_account_number, bank_account_name, whatsapp, nip, notification_tone, morning_briefing_enabled, weekly_recap_enabled } = profileData;

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

    if (notification_tone !== undefined) {
      const allowed = ["hangat", "formal", "santai"];
      const tone = allowed.includes(notification_tone) ? notification_tone : "hangat";
      sets.push(`notification_tone = $${idx}`);
      values.push(tone);
      idx++;
    }

    if (morning_briefing_enabled !== undefined) {
      sets.push(`morning_briefing_enabled = $${idx}`);
      values.push(morning_briefing_enabled === true);
      idx++;
    }

    if (weekly_recap_enabled !== undefined) {
      sets.push(`weekly_recap_enabled = $${idx}`);
      values.push(weekly_recap_enabled === true);
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
               bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at, photo_url, notification_tone
        FROM users WHERE id = $1`,
      [userId]
    );

    const [pricingConfig, pricingPlans] = await Promise.all([
      getActivePricingPlans(),
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
