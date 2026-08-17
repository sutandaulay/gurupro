import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActivePricingPlans } from "@/lib/settings";
import { getTokensPerPoin } from "@/src/config/ratio-cache";
import { getUserAccountMode, getUserActiveMemberships } from "@/lib/institution-members";
import { SessionData, buildSignedSessionCookie, getSession, setDefaultSessionCookie } from "@/lib/session";
import { parseSessionCookie } from "@/lib/session-sign";

const PROFILE_SELECT = `id, username, email, whatsapp, nama_lengkap, nama_sekolah, role, status_langganan,
  quota_poin_total, quota_poin_used, addon_poin, addon_poin_used, token_accumulated, referral_code, cashback_balance,
  bank_name, bank_account_number, bank_account_name, subscription_start, subscription_end, created_at,
  photo_url, signature_url, notification_tone, morning_briefing_enabled, weekly_recap_enabled, gender`;

async function syncFromNextAuth(): Promise<{ synced: boolean; oauthImage?: string | null }> {
  try {
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
        return { synced: true, oauthImage: nextAuthSession.user.image || null };
      }
    }
  } catch (error) {
    console.warn("NextAuth not available or error occurred:", error);
  }
  return { synced: false };
}

async function getOAuthImage(): Promise<string | null> {
  try {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth.config");
    const nextAuthSession = await getServerSession(authOptions);
    return nextAuthSession?.user?.image || null;
  } catch {
    return null;
  }
}

async function fetchProfileData(userId: string, oauthImage: string | null) {
  const userRes = await query(
    `SELECT ${PROFILE_SELECT} FROM users WHERE id = $1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    return null;
  }

  const user = userRes.rows[0];
  const pricingPlans = await getActivePricingPlans();
  const tokensPerPoin = await getTokensPerPoin();

  const [memberships, accountMode] = await Promise.allSettled([
    getUserActiveMemberships(userId),
    getUserAccountMode(userId),
  ]).then(results => [
    results[0].status === 'fulfilled' ? results[0].value : [],
    results[1].status === 'fulfilled' ? results[1].value : 'personal',
  ]);

  let activeSchool = null;
  try {
    const cookieStore = await cookies();
    const schoolId = cookieStore.get("gurupro_school_selected")?.value;
    if (schoolId) {
      const schoolRes = await query(
        "SELECT id, nama_sekolah, npsn, alamat, logo FROM schools WHERE id = $1",
        [schoolId]
      );
      if (schoolRes.rows.length > 0) {
        activeSchool = schoolRes.rows[0];
      }
    }
  } catch (e) {
    console.warn("Could not fetch active school:", e);
  }

  const mainPoinTotal = user.quota_poin_total || 0;
  const mainPoinUsed = user.quota_poin_used || 0;
  const mainPoinAvailable = Math.max(0, mainPoinTotal - mainPoinUsed);
  const addonPoinTotal = user.addon_poin || 0;
  const addonPoinUsed = user.addon_poin_used || 0;
  const addonPoinAvailable = Math.max(0, addonPoinTotal - addonPoinUsed);

  let voiceBriefingPrefs: any = { voice_briefing_enabled: false, voice_name_preference: "" };
  try {
    const vpRes = await query(
      `SELECT voice_briefing_enabled, voice_name_preference FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );
    if (vpRes.rows.length > 0) {
      voiceBriefingPrefs = vpRes.rows[0];
    }
  } catch {
    // table may not exist yet
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    whatsapp: user.whatsapp,
    nama_lengkap: user.nama_lengkap,
    nama_sekolah: user.nama_sekolah,
    role: user.role,
    status_langganan: user.status_langganan,
    referral_code: user.referral_code,
    cashback_balance: user.cashback_balance || 0,
    timezone: user.timezone || 'Asia/Jakarta',
    quota_poin_total: mainPoinTotal,
    quota_poin_used: mainPoinUsed,
    quota_poin_available: mainPoinAvailable,
    addon_poin_total: addonPoinTotal,
    addon_poin_used: addonPoinUsed,
    addon_poin_available: addonPoinAvailable,
    token_limit: mainPoinAvailable + addonPoinAvailable,
    token_accumulated: user.token_accumulated || 0,
    tokens_per_poin: tokensPerPoin || 2000,
    bank_name: user.bank_name,
    bank_account_number: user.bank_account_number,
    bank_account_name: user.bank_account_name,
    subscription_start: user.subscription_start,
    subscription_end: user.subscription_end,
    created_at: user.created_at,
    photo_url: user.photo_url || oauthImage || null,
    signature_url: user.signature_url || null,
    notification_tone: user.notification_tone || "hangat",
    morning_briefing_enabled: user.morning_briefing_enabled !== false,
    weekly_recap_enabled: user.weekly_recap_enabled !== false,
    gender: user.gender || null,
    voice_briefing_enabled: voiceBriefingPrefs.voice_briefing_enabled === true,
    voice_name_preference: voiceBriefingPrefs.voice_name_preference || "",
    activeSchool,
    memberships,
    accountMode,
    pricingConfig: pricingPlans,
    pricingPlans,
  };
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.id) {
      const { synced, oauthImage } = await syncFromNextAuth();
      if (!synced) {
        return NextResponse.json({ error: "Sesi tidak aktif. Silakan login." }, { status: 401 });
      }

      const newSession = await getSession();
      if (!newSession?.id) {
        return NextResponse.json({ error: "Sesi tidak aktif. Silakan login." }, { status: 401 });
      }

      const profileData = await fetchProfileData(newSession.id, oauthImage);
      if (!profileData) {
        return NextResponse.json({ error: "Sesi tidak aktif. Silakan login." }, { status: 401 });
      }

      return NextResponse.json(profileData);
    }

    const oauthImage = await getOAuthImage();

    const profileData = await fetchProfileData(session.id, oauthImage);
    if (!profileData) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login." }, { status: 401 });
    }

    return NextResponse.json(profileData);
  } catch (error: any) {
    console.error("Error getting user profile:", error);
    const message =
      error?.message?.includes("timeout")
        ? "Koneksi database timeout. Silakan coba lagi."
        : error?.message || "Gagal memuat profil.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);

    if (!session) {
      return NextResponse.json({ error: "Sesi tidak aktif. Silakan login kembali." }, { status: 401 });
    }

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
        "SELECT id, password_hash FROM users WHERE id = $1",
        [userId]
      );

      if (userRes.rows.length === 0) {
        return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
      }

      const user = userRes.rows[0];

      // Verify current password
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(current_password, user.password_hash);

      if (!isValid) {
        return NextResponse.json({ error: "Password saat ini salah" }, { status: 400 });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(new_password, 12);

      // Update password
      await query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [hashedPassword, userId]
      );

      // Password change invalidates all existing sessions (except this one
      // is self-revoked conceptually; issue a fresh sid below)
      try {
        await query(
          `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId]
        );
      } catch (err) {
        console.error("Revoke sessions after password change failed:", err);
      }

      return NextResponse.json({ message: "Password berhasil diubah!" });
    }

    // Handle profile update
    const { nama_lengkap, username, bank_name, bank_account_number, bank_account_name, whatsapp, nip, notification_tone, morning_briefing_enabled, weekly_recap_enabled, timezone } = profileData;

    const sets: string[] = [];
    const values: (string | null)[] = [];
    let idx = 1;

    if (nama_lengkap !== undefined) {
      if (!nama_lengkap || !nama_lengkap.trim()) {
        return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
      }
      sets.push(`nama_lengkap = $${idx}`);
      values.push(nama_lengkap.trim());
      idx++;
    }

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

    if (timezone !== undefined) {
      sets.push(`timezone = $${idx}`);
      values.push(timezone || 'Asia/Jakarta');
      idx++;
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "Tidak ada data yang diperbarui." }, { status: 400 });
    }

    values.push(userId);
    await query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`,
      values
    );

    // Update session cookie (re-signed) with the new role (preserve activeContext)
    const sessionData = buildSignedSessionCookie({
      id: userId,
      role: session.role || 'guru',
      roles: session.roles ?? [],
      activeContext: session.activeContext ?? 'individual',
      lastInstitutionId: session.lastInstitutionId ?? null,
    });
    cookieStore.set('gurupro_session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    const updatedUser = await query(
      `SELECT ${PROFILE_SELECT} FROM users WHERE id = $1`,
      [userId]
    );

    const pricingPlans = await getActivePricingPlans();

    const updated = updatedUser.rows[0];
    const mainAvail = Math.max(0, (updated.quota_poin_total || 0) - (updated.quota_poin_used || 0));
    const addonAvail = Math.max(0, (updated.addon_poin || 0) - (updated.addon_poin_used || 0));

    return NextResponse.json({
      message: "Profil berhasil diperbarui!",
      user: {
        ...updated,
        quota_poin_available: mainAvail,
        addon_poin_available: addonAvail,
        token_limit: mainAvail + addonAvail,
      },
      pricingConfig: pricingPlans,
      pricingPlans,
    });
  } catch (error: any) {
    console.error("Profile PUT API error:", error);
    const message =
      error?.message?.includes("timeout")
        ? "Koneksi database timeout. Silakan coba lagi."
        : error?.message || "Gagal memperbarui profil.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Keep POST for backward compatibility
export async function POST(req: Request) {
  return PUT(req);
}
