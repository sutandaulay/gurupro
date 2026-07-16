"use server";

import { query } from "@/lib/db";
import { redirect } from "next/navigation";
import { hashPassword, comparePassword } from "@/lib/auth";
import { sendEventNotification } from "@/lib/notifications";
import { setDefaultSessionCookie } from "@/lib/session";
import { normalizeEmail, normalizePhoneNumber } from "@/lib/performance-share";
import crypto from "crypto";
import { cookies } from "next/headers";

type AuthResult = {
  error?: string | null;
  requiresOtp?: boolean;
  userId?: string;
  needsSelection?: boolean;
  redirectUrl?: string;
};

export async function handleAuth(
  prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const authMode = formData.get("auth_mode")?.toString() || "login";
  const emailRaw = formData.get("email")?.toString().trim() || "";
  const password = formData.get("password")?.toString() || "";
  const whatsappRaw = formData.get("whatsapp")?.toString().trim() || "";
  const namaLengkap = formData.get("nama_lengkap")?.toString().trim() || "Guru Mandiri";
  const usernameRaw = formData.get("username")?.toString().trim().toLowerCase() || "";
  const pdpConsent = formData.get("pdp_consent")?.toString() === "on" || formData.get("pdp_consent")?.toString() === "true";
  const pdpPolicyVersion = formData.get("pdp_policy_version")?.toString() || "1.0";
  const referralCode = formData.get("referral_code")?.toString().trim().toUpperCase() || "";
  const invitationToken = formData.get("invitation_token")?.toString().trim() || "";
  const checkoutPlan = formData.get("checkout_plan")?.toString() || "";

  if (!emailRaw || !password) {
    return { error: "Email/Username dan Password wajib diisi!" };
  }

  let user = null;
  let targetRedirectUrl = "";

  try {
    if (authMode === "login") {
      // 1. LOGIN FLOW
      const loginId = emailRaw.toLowerCase();

      const userRes = await query(
        `SELECT id, email, username, whatsapp, role, password_hash, is_active, 
                login_attempts, lock_until, phone_verified, email_verified 
         FROM users 
         WHERE LOWER(email) = $1 OR LOWER(username) = $1`,
        [loginId]
      );

      if (userRes.rows.length === 0) {
        return { error: "Email atau Password salah!" };
      }

      user = userRes.rows[0];

      // Lockout Check
      if (user.lock_until) {
        const lockUntil = new Date(user.lock_until);
        if (lockUntil > new Date()) {
          const remainingMinutes = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
          return { error: `Akun Anda terkunci sementara. Coba lagi dalam ${remainingMinutes} menit.` };
        }
      }

      if (user.is_active === false) {
        return { error: "Akun Anda dinonaktifkan oleh Admin." };
      }

      // Password verify
      if (user.password_hash === null) {
        const hashed = await hashPassword(password);
        await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashed, user.id]);
        user.password_hash = hashed;
      }

      const match = await comparePassword(password, user.password_hash);
      if (!match) {
        const newAttempts = (user.login_attempts || 0) + 1;
        let lockUntilSql = null;
        let errorMsg = "Email atau Password salah!";

        if (newAttempts >= 5) {
          lockUntilSql = new Date(Date.now() + 10 * 60 * 1000);
          errorMsg = "Terlalu banyak percobaan login gagal. Akun Anda terkunci sementara selama 10 menit.";
          
          await query(
            `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [user.id, "Lockout Akun", "Akun dikunci karena 5x salah password", "127.0.0.1"]
          );
        } else {
          errorMsg = `Email atau Password salah! (Sisa percobaan: ${5 - newAttempts})`;
        }

        await query(
          "UPDATE users SET login_attempts = $1, lock_until = $2 WHERE id = $3",
          [newAttempts, lockUntilSql, user.id]
        );

        return { error: errorMsg };
      }

      // Reset login attempts
      await query(
        "UPDATE users SET login_attempts = 0, lock_until = NULL WHERE id = $1",
        [user.id]
      );

      // Verification Gate
      if (!user.phone_verified && !user.email_verified) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

        await query(
          `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
           VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
          [otpHash, "whatsapp", user.whatsapp]
        );

        await sendEventNotification("forgot_password", {
          email: user.email,
          whatsapp: user.whatsapp,
          nama_lengkap: user.nama_lengkap || "User GuruPRO"
        }, { otp_code: otp });

        return { 
          error: "Akun Anda belum terverifikasi! Kode OTP baru telah dikirim.", 
          requiresOtp: true, 
          userId: user.id 
        };
      }

      // Multi-school check
      const membershipRes = await query(
        `SELECT COUNT(*) as count FROM payload.institution_members WHERE app_user_id = $1 AND status = 'active'`,
        [user.id]
      );
      const activeMembershipsCount = parseInt(membershipRes.rows[0].count || "0");

      await setDefaultSessionCookie({ id: user.id, role: user.role || "guru" });

      if (activeMembershipsCount >= 2) {
        targetRedirectUrl = "/select-context";
      } else if (user.role === "admin") {
        targetRedirectUrl = "/admin";
      } else if (checkoutPlan) {
        targetRedirectUrl = `/dashboard?checkout=${checkoutPlan}`;
      } else {
        targetRedirectUrl = "/dashboard";
      }
    } else {
      // 2. REGISTER FLOW
      if (!pdpConsent) {
        return { error: "Persetujuan UU PDP wajib dicentang!" };
      }

      const cleanEmail = normalizeEmail(emailRaw);
      const cleanPhone = normalizePhoneNumber(whatsappRaw);

      if (!cleanEmail) {
        return { error: "Format email tidak valid!" };
      }
      if (!cleanPhone) {
        return { error: "Format nomor WhatsApp tidak valid! Harus +62..." };
      }

      // Password strength validation
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        return { error: "Kata sandi minimal 8 karakter dan harus berisi kombinasi huruf dan angka!" };
      }

      // Check unique constraints
      const existingUser = await query(
        "SELECT id, password_hash FROM users WHERE email = $1 OR whatsapp = $2",
        [cleanEmail, cleanPhone]
      );

      if (existingUser.rows.length > 0) {
        const userRow = existingUser.rows[0];
        if (invitationToken) {
          const match = await comparePassword(password, userRow.password_hash || "");
          if (!match) {
            return { error: "Kata sandi salah untuk akun terdaftar Anda." };
          }
          await query("UPDATE users SET pending_invitation_token = $1 WHERE id = $2", [invitationToken, userRow.id]);

          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

          await query(
            `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
            [otpHash, "whatsapp", cleanPhone]
          );

          await sendEventNotification("forgot_password", {
            email: cleanEmail,
            whatsapp: cleanPhone,
            nama_lengkap: namaLengkap
          }, { otp_code: otp });

          return { 
            requiresOtp: true, 
            userId: userRow.id, 
            error: "Akun terdaftar terdeteksi. Silakan verifikasi kode OTP yang dikirim." 
          };
        } else {
          return { error: "Email atau Nomor WhatsApp sudah terdaftar!" };
        }
      }

      // Username validate
      if (usernameRaw) {
        if (!/^[a-z0-9._-]{3,80}$/.test(usernameRaw)) {
          return { error: "Username tidak valid." };
        }
        const usernameTaken = await query("SELECT id FROM users WHERE LOWER(username) = $1", [usernameRaw]);
        if (usernameTaken.rows.length > 0) {
          return { error: "Username sudah digunakan." };
        }
      }

      const selfRefCode = "GPRO-" + Math.random().toString(36).substring(2, 7).toUpperCase();
      let referredByUserId = null;
      let refereeTokenBonus = 0;

      if (referralCode) {
        const referrer = await query("SELECT id FROM users WHERE referral_code = $1", [referralCode]);
        if (referrer.rows.length > 0) {
          referredByUserId = referrer.rows[0].id;
          refereeTokenBonus = 10;
          await query(
            "UPDATE users SET token_limit = token_limit + 20, cashback_balance = cashback_balance + 10000 WHERE id = $1",
            [referredByUserId]
          );
        }
      }

      const hashed = await hashPassword(password);

      // Create new user unverified
      const newUser = await query(
        `INSERT INTO users (
           username, email, whatsapp, nama_lengkap, token_limit, referral_code, referred_by, 
           password_hash, subscription_start, subscription_end, status_langganan, is_active,
           pdp_consent_given, pdp_consent_version, pdp_consent_date, phone_verified, email_verified,
           account_type, pending_invitation_token
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'free', TRUE, TRUE, $9, NOW(), FALSE, FALSE, 'individual', $10)
         RETURNING id, email, whatsapp`,
        [usernameRaw || null, cleanEmail, cleanPhone, namaLengkap, 5 + refereeTokenBonus, selfRefCode, referredByUserId, hashed, pdpPolicyVersion, invitationToken || null]
      );

      const createdUser = newUser.rows[0];

      if (referredByUserId) {
        await query(
          `INSERT INTO referrals (referrer_id, referee_id, reward_tokens, cashback_amount)
           VALUES ($1, $2, 20, 10000)`,
          [referredByUserId, createdUser.id]
        );
      }

      await query(
        `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [createdUser.id, "Registrasi Akun", "Registrasi sukses via Server Action, menunggu OTP", "127.0.0.1"]
      );

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

      await query(
        `INSERT INTO payload.otp_verifications (otp_hash, channel, sent_to, expires_at, attempt_count, purpose, created_at, updated_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, 'account_verification', NOW(), NOW())`,
        [otpHash, "whatsapp", cleanPhone]
      );

      await sendEventNotification("forgot_password", {
        email: cleanEmail,
        whatsapp: cleanPhone,
        nama_lengkap: namaLengkap
      }, { otp_code: otp });

      return { 
        requiresOtp: true, 
        userId: createdUser.id,
        error: "Registrasi sukses! Masukkan kode OTP verifikasi Anda."
      };
    }
  } catch (err) {
    console.error("handleAuth Error:", err);
    return { error: "Terjadi kesalahan koneksi sistem." };
  }

  if (targetRedirectUrl) {
    redirect(targetRedirectUrl);
  }

  return {};
}
