/**
 * Shared login/register logic — used by both route handlers and Server Actions.
 * Single source of truth to prevent drift.
 */
import { query } from "@/lib/db";
import { hashPassword, comparePassword } from "@/lib/auth";
import { setDefaultSessionCookie } from "@/lib/session";
import { sendEventNotification } from "@/lib/notifications";
import { normalizeEmail, normalizePhoneNumber } from "@/lib/performance-share";
import { generateSecureOTP } from "@/lib/auth-utils";

export interface LoginResult {
  error?: string;
  requiresOtp?: boolean;
  userId?: string;
  needsSelection?: boolean;
  redirectUrl?: string;
  role?: string;
}

export interface LoginInput {
  loginId: string; // email or username
  password: string;
  checkoutPlan?: string;
}

/** Returns null on success with redirectUrl, throws on system error. */
export async function performLogin(input: LoginInput): Promise<LoginResult> {
  const { loginId, password, checkoutPlan } = input;

  const userRes = await query(
    `SELECT id, email, username, whatsapp, role, password_hash, is_active,
            login_attempts, lock_until, phone_verified, email_verified
     FROM users
     WHERE LOWER(email) = $1 OR LOWER(username) = $1`,
    [loginId.toLowerCase()]
  );

  if (userRes.rows.length === 0) {
    return { error: "Email atau Password salah!" };
  }

  const user = userRes.rows[0];

  // Lockout check
  if (user.lock_until) {
    const lockUntil = new Date(user.lock_until);
    if (lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
      return { error: `Akun Anda terkunci sementara. Coba lagi dalam ${remainingMinutes} menit.` };
    }
  }

  // Active check
  if (user.is_active === false) {
    return { error: "Akun Anda dinonaktifkan oleh Admin." };
  }

  // Password migration
  if (user.password_hash === null) {
    const hashed = await hashPassword(password);
    await query("UPDATE users SET password_hash = $1, login_attempts = 0, lock_until = NULL WHERE id = $2", [hashed, user.id]);
    user.password_hash = hashed;
  }

  const match = await comparePassword(password, user.password_hash);
  if (!match) {
    const newAttempts = (user.login_attempts || 0) + 1;
    let lockUntilSql: string | null = null;
    let errorMsg = "Email atau Password salah!";

    if (newAttempts >= 5) {
      lockUntilSql = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      errorMsg = "Terlalu banyak percobaan login gagal. Akun Anda terkunci sementara selama 10 menit.";

      await query(
        `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [user.id, "Lockout Akun", "Akun dikunci karena 5x salah password", "system"]
      );

      await sendEventNotification("forgot_password", {
        email: user.email,
        whatsapp: user.whatsapp,
        nama_lengkap: user.nama_lengkap || "User GuruPRO",
      }, { otp_code: "LOGALERT" });
    } else {
      errorMsg = `Email atau Password salah! (Sisa percobaan: ${5 - newAttempts})`;
    }

    await query(
      "UPDATE users SET login_attempts = $1, lock_until = $2 WHERE id = $3",
      [newAttempts, lockUntilSql, user.id]
    );

    return { error: errorMsg };
  }

  // Reset login attempts on success
  await query(
    "UPDATE users SET login_attempts = 0, lock_until = NULL WHERE id = $1",
    [user.id]
  );

  // Verification gate
  if (!user.phone_verified && !user.email_verified) {
    const otp = generateSecureOTP();

    await query(
      `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
      [otp, "whatsapp", user.whatsapp]
    );

    await sendEventNotification("forgot_password", {
      email: user.email,
      whatsapp: user.whatsapp,
      nama_lengkap: user.nama_lengkap || "User GuruPRO",
    }, { otp_code: otp });

    return {
      error: "Akun Anda belum terverifikasi! Kode OTP baru telah dikirim.",
      requiresOtp: true,
      userId: String(user.id),
    };
  }

  // Multi-school check + institution roles
  const membershipRes = await query(
    `SELECT
       im.id,
       im.institution_id,
       im.created_at,
       COALESCE(
         (SELECT array_agg(imr.value ORDER BY imr.id)
          FROM public.institution_members_role imr
          WHERE imr.parent_id = im.id),
         ARRAY['guru']
       ) AS institution_roles
     FROM public.institution_members im
     WHERE im.app_user_id = $1 AND im.status = 'active'
     ORDER BY im.created_at DESC
     LIMIT 1`,
    [user.id]
  );
  const member = membershipRes.rows[0];
  const activeMembershipsCount = membershipRes.rows.length;
  const institutionRoles: string[] = Array.isArray(member?.institution_roles)
    ? member.institution_roles
    : [];
  const primaryRole = institutionRoles[0] || user.role || "guru";

  let activeContext: "individual" | { institutionId: number } = "individual";
  let targetRedirectUrl = "/dashboard";

  if (user.role === "admin") {
    targetRedirectUrl = "/admin";
  } else if (activeMembershipsCount === 1) {
    const instId = member.institution_id;
    activeContext = { institutionId: instId };
    targetRedirectUrl = `/institusi/${instId}/dashboard`;
  } else if (activeMembershipsCount === 0) {
    targetRedirectUrl = checkoutPlan ? "/dashboard/billing?checkout=" + checkoutPlan : "/dashboard";
  } else {
    // >=2 memberships: prefer restoring the last institution used
    const lastRes = await query(
      "SELECT last_institution_id FROM users WHERE id = $1",
      [user.id]
    );
    const lastInstId = lastRes.rows[0]?.last_institution_id;
    if (lastInstId != null && Number(member.institution_id) !== Number(lastInstId)) {
      const stillMember = await query(
        `SELECT 1 FROM public.institution_members
         WHERE app_user_id = $1 AND institution_id = $2 AND status = 'active'`,
        [user.id, lastInstId]
      );
      if (stillMember.rows.length > 0) {
        activeContext = { institutionId: Number(lastInstId) };
        targetRedirectUrl = `/institusi/${lastInstId}/dashboard`;
      } else {
        // last institution is stale — direct to selector, clear it next login
        activeContext = "individual";
        targetRedirectUrl = checkoutPlan ? `/select-context?checkout=${checkoutPlan}` : "/select-context";
      }
    } else {
      targetRedirectUrl = checkoutPlan ? `/select-context?checkout=${checkoutPlan}` : "/select-context";
    }
  }

  // Create a server-side session (enables logout / password-change revocation)
  let sid: string | undefined;
  try {
    const { createServerSession } = await import("@/lib/session");
    sid = await createServerSession(String(user.id));
  } catch (err) {
    console.error("Create server session failed:", err);
  }

  await setDefaultSessionCookie({
    id: String(user.id),
    role: primaryRole,
    roles: institutionRoles,
    lastInstitutionId:
      activeContext === "individual" ? null : activeContext.institutionId,
    activeContext,
    sid,
  });

  return {
    redirectUrl: targetRedirectUrl,
    needsSelection: activeMembershipsCount >= 2,
    role: primaryRole,
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  whatsapp: string;
  namaLengkap?: string;
  username?: string;
  pdpConsent: boolean;
  pdpPolicyVersion?: string;
  referralCode?: string;
  invitationToken?: string;
  accountType?: "individual" | "institutional";
  checkoutPlan?: string;
}

export interface RegisterResult {
  error?: string;
  requiresOtp?: boolean;
  userId?: string;
  checkoutPlan?: string;
  message?: string;
}

export async function performRegister(input: RegisterInput): Promise<RegisterResult> {
  const {
    email, password, confirmPassword, whatsapp,
    namaLengkap = "Guru Mandiri", username,
    pdpConsent, pdpPolicyVersion = "1.0",
    referralCode, invitationToken, accountType = "individual",
    checkoutPlan,
  } = input;

  if (!pdpConsent) {
    return { error: "Persetujuan UU PDP wajib dicentang!" };
  }

  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhoneNumber(whatsapp);

  if (!cleanEmail) return { error: "Format email tidak valid!" };
  if (!cleanPhone) return { error: "Format nomor WhatsApp tidak valid! Harus +62..." };

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return { error: "Kata sandi minimal 8 karakter dan harus berisi kombinasi huruf dan angka!" };
  }

  if (password !== confirmPassword) {
    return { error: "Kata sandi dan konfirmasi kata sandi tidak cocok!" };
  }

  // Check existing user
  const existingUser = await query(
    "SELECT id, password_hash FROM users WHERE email = $1 OR whatsapp = $2",
    [cleanEmail, cleanPhone]
  );

  if (existingUser.rows.length > 0) {
    const userRow = existingUser.rows[0];

    if (invitationToken) {
      const match = await comparePassword(password, userRow.password_hash || "");
      if (!match) return { error: "Kata sandi salah untuk akun terdaftar Anda." };

      await query("UPDATE users SET pending_invitation_token = $1 WHERE id = $2", [invitationToken, userRow.id]);

      const otp = generateSecureOTP();
      await query(
        `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
        [otp, "whatsapp", cleanPhone]
      );

      await sendEventNotification("forgot_password", {
        email: cleanEmail, whatsapp: cleanPhone, nama_lengkap: namaLengkap,
      }, { otp_code: otp });

      return {
        requiresOtp: true,
        userId: String(userRow.id),
        error: "Akun terdaftar terdeteksi. Silakan verifikasi kode OTP yang dikirim.",
      };
    }

    return { error: "Email atau Nomor WhatsApp sudah terdaftar!" };
  }

  // Username check
  if (username) {
    if (!/^[a-z0-9._-]{3,80}$/.test(username)) {
      return { error: "Username tidak valid." };
    }
    const usernameTaken = await query("SELECT id FROM users WHERE LOWER(username) = $1", [username.toLowerCase()]);
    if (usernameTaken.rows.length > 0) {
      return { error: "Username sudah digunakan." };
    }
  }

  const selfRefCode = "GPRO-" + Math.random().toString(36).substring(2, 7).toUpperCase();
  let referredByUserId: string | null = null;

  if (referralCode) {
    const referrer = await query("SELECT id FROM users WHERE referral_code = $1", [referralCode.trim().toUpperCase()]);
    if (referrer.rows.length > 0) {
      referredByUserId = referrer.rows[0].id;
    }
  }

  const hashed = await hashPassword(password);

  const newUser = await query(
    `INSERT INTO users (
       username, email, whatsapp, nama_lengkap, quota_poin_total, referral_code, referred_by,
       password_hash, subscription_start, subscription_end, status_langganan, is_active,
       pdp_consent_given, pdp_consent_version, pdp_consent_date, phone_verified, email_verified,
       account_type, pending_invitation_token
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'free', TRUE, TRUE, $9, NOW(), FALSE, FALSE, $10, $11)
     RETURNING id, email, whatsapp`,
    [
      username || null, cleanEmail, cleanPhone, namaLengkap,
      5, selfRefCode, referredByUserId, hashed,
      pdpPolicyVersion, accountType, invitationToken || null,
    ]
  );

  const createdUser = newUser.rows[0];

  await query(
    `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [
      createdUser.id,
      "Registrasi Akun Baru",
      `Registrasi${referredByUserId ? " (referral used, reward on paid)" : ""} via unified auth`,
      "system",
    ]
  );

  const otp = generateSecureOTP();
  await query(
    `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
    [otp, "whatsapp", cleanPhone]
  );

  await sendEventNotification("forgot_password", {
    email: cleanEmail, whatsapp: cleanPhone, nama_lengkap: namaLengkap,
  }, { otp_code: otp });

  return {
    requiresOtp: true,
    userId: String(createdUser.id),
    checkoutPlan,
    message: "Registrasi sukses! Masukkan kode OTP verifikasi Anda.",
  };
}
