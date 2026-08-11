import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { getClientIP } from "@/lib/auth-utils";
import * as crypto from "crypto";

export async function POST(req: Request) {
  const clientIP = getClientIP(req);
  try {
    const { email, userId, otp, password, purpose = "password_reset", checkoutPlan = "" } = await req.json();

    if (!otp) {
      return NextResponse.json({ error: "Kode OTP wajib diisi!" }, { status: 400 });
    }

    if (purpose === "password_reset" && !password) {
      return NextResponse.json({ error: "Kata sandi baru wajib diisi untuk reset password!" }, { status: 400 });
    }

    // Validate password strength for reset: min 8 chars + letters + numbers
    if (purpose === "password_reset" && password) {
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        return NextResponse.json(
          { error: "Kata sandi baru minimal 8 karakter dan harus berisi kombinasi huruf dan angka!" },
          { status: 400 }
        );
      }
    }

    let user = null;

    if (userId) {
      const userRes = await query("SELECT * FROM users WHERE id = $1", [userId]);
      if (userRes.rows.length > 0) user = userRes.rows[0];
    } else if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const userRes = await query(
        "SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1",
        [cleanEmail]
      );
      if (userRes.rows.length > 0) user = userRes.rows[0];
    }

    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan!" }, { status: 404 });
    }

    // Find the most recent pending OTP verification in payload schema
    const otpRes = await query(
      `SELECT id, otp_hash, attempt_count, expires_at, verified_at 
       FROM payload.otp_verifications 
       WHERE (sent_to = $1 OR sent_to = $2) AND purpose = $3 AND verified_at IS NULL 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [user.whatsapp, user.email, purpose]
    );

    if (otpRes.rows.length === 0) {
      return NextResponse.json({ error: "Kode OTP tidak valid atau sudah kedaluwarsa!" }, { status: 400 });
    }

    const otpRecord = otpRes.rows[0];

    // Check expiration
    if (new Date(otpRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: "Kode OTP telah kedaluwarsa!" }, { status: 400 });
    }

    // Check attempts limit
    if (otpRecord.attempt_count >= 5) {
      return NextResponse.json(
        { error: "Batas percobaan verifikasi telah habis. Silakan kirim ulang OTP." },
        { status: 400 }
      );
    }

    // Verify code
    const cleanOtp = otp.trim();
    const inputHash = crypto.createHash("sha256").update(cleanOtp).digest("hex");
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(inputHash, "hex"),
      Buffer.from(otpRecord.otp_hash, "hex")
    );

    if (!isMatch) {
      // Increment attempt count
      const nextAttempt = (otpRecord.attempt_count || 0) + 1;
      await query(
        `UPDATE payload.otp_verifications 
         SET attempt_count = $1, updated_at = NOW() 
         WHERE id = $2`,
        [nextAttempt, otpRecord.id]
      );
      return NextResponse.json(
        { error: `Kode OTP salah! (Sisa percobaan: ${5 - nextAttempt})` },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await query(
      `UPDATE payload.otp_verifications 
       SET verified_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [otpRecord.id]
    );

    // ACTION 1: Account Verification Flow
    if (purpose === "account_verification") {
      // Mark user verification columns as true
      await query(
        `UPDATE users 
         SET phone_verified = TRUE, email_verified = TRUE 
         WHERE id = $1`,
        [user.id]
      );

      // Check for pending invitation token to merge
      if (user.pending_invitation_token) {
        const invRes = await query(
          `SELECT id, institution_id, expires_at, status 
           FROM payload.invitations 
           WHERE token = $1 AND status = 'pending' 
           LIMIT 1`,
          [user.pending_invitation_token]
        );

        if (invRes.rows.length > 0) {
          const invitation = invRes.rows[0];
          const isExpired = new Date(invitation.expires_at) < new Date();

          if (!isExpired) {
            // Get or create Payload cms_users entry
            let cmsUserId = null;
            const cmsCheck = await query(
              "SELECT id FROM payload.cms_users WHERE email = $1",
              [user.email]
            );

            if (cmsCheck.rows.length > 0) {
              cmsUserId = cmsCheck.rows[0].id;
            } else {
              const newCms = await query(
                `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at, created_at, updated_at)
                 VALUES ($1, $2, 'editor', '', '', true, '1.0', NOW(), NOW(), NOW())
                 RETURNING id`,
                [user.nama_lengkap, user.email]
              );
              cmsUserId = newCms.rows[0].id;
            }

            // Create institution membership
            const memberCheck = await query(
              "SELECT id FROM public.institution_members WHERE app_user_id = $1 AND institution_id = $2 LIMIT 1",
              [user.id, invitation.institution_id]
            );

            if (memberCheck.rows.length === 0) {
              const newMember = await query(
                `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
                 VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW()) 
                 RETURNING id`,
                [cmsUserId, user.id, invitation.institution_id]
              );

              // Set default role as 'guru' in role relationship table
              await query(
                `INSERT INTO payload.institution_members_role ("order", parent_id, value)
                 VALUES (1, $1, 'guru') 
                 ON CONFLICT DO NOTHING`,
                [newMember.rows[0].id]
              );
            } else {
              // Update status to active
              await query(
                `UPDATE payload.institution_members 
                 SET status = 'active', joined_at = NOW(), updated_at = NOW() 
                 WHERE id = $1`,
                [memberCheck.rows[0].id]
              );
            }

            // Update invitation status to used
            await query(
              `UPDATE payload.invitations 
               SET status = 'used', updated_at = NOW() 
               WHERE id = $1`,
              [invitation.id]
            );

            // Audit merge log
            await query(
              `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
               VALUES ($1, $2, $3, $4)`,
              [user.id, "Gabung Institusi", `Akun digabung ke institusi ID ${invitation.institution_id} via undangan`, clientIP]
            );
          }
        }

        // Clear pending token in any case
        await query(
          "UPDATE users SET pending_invitation_token = NULL WHERE id = $1",
          [user.id]
        );
      }

      // Check memberships count for context switcher
      const membershipRes = await query(
        `SELECT COUNT(*) as count 
         FROM public.institution_members 
         WHERE app_user_id = $1 AND status = 'active'`,
        [user.id]
      );
      const activeCount = parseInt(membershipRes.rows[0].count || "0");

      const sessionData = JSON.stringify({
        id: user.id,
        role: user.role || "guru",
        activeContext: "individual",
      });

      const redirectUrl = checkoutPlan
        ? (activeCount >= 2 ? "/select-context?checkout=" : "/dashboard/billing?checkout=") + checkoutPlan
        : activeCount >= 2
          ? "/select-context"
          : "/dashboard";

      const response = NextResponse.json({
        success: true,
        redirectUrl,
        needsSelection: activeCount >= 2,
        message: "Akun Anda berhasil diverifikasi!"
      });

      // Set session cookie
      response.cookies.set("gurupro_session", sessionData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // CSRF protection
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return response;
    }

    // ACTION 2: Password Reset Flow
    if (purpose === "password_reset") {
      const hashed = await hashPassword(password);
      await query(
        `UPDATE users 
         SET password_hash = $1, login_attempts = 0, lock_until = NULL 
         WHERE id = $2`,
        [hashed, user.id]
      );

      // Audit trail
      await query(
        `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [user.id, "Reset Password", "Reset password sukses via OTP verifikasi", clientIP]
      );

      return NextResponse.json({
        success: true,
        message: "Kata sandi Anda berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda."
      });
    }

    return NextResponse.json({ error: "Tujuan verifikasi tidak dikenal." }, { status: 400 });
  } catch (error: any) {
    console.error("OTP verification error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses verifikasi OTP" }, { status: 500 });
  }
}
