"use server";

import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { hashPassword, comparePassword } from '@/lib/auth';
import { sendEventNotification } from '@/lib/notifications';
import { setDefaultSessionCookie } from '@/lib/session';

type AuthUser = {
  id: string;
  email: string;
  username?: string | null;
  whatsapp: string;
  nama_lengkap?: string;
  role?: string | null;
  password_hash?: string | null;
  is_active?: boolean | null;
};

export async function handleAuth(
  prevState: { error: string | null } | null,
  formData: FormData
) {
  const authMode = formData.get('auth_mode')?.toString() || 'login';
  const loginId = formData.get('email')?.toString().trim().toLowerCase();
  const whatsapp = formData.get('whatsapp')?.toString().trim();
  const namaLengkap = formData.get('nama_lengkap')?.toString().trim() || 'Guru Mandiri';
  const password = formData.get('password')?.toString();
  const checkoutPlan = formData.get('checkout_plan')?.toString();

  if (!loginId || !password) {
    return { error: 'Email/Username dan Password wajib diisi!' };
  }

  let user: AuthUser | null = null;

  try {

    if (authMode === 'login') {
      // 1. LOGIN FLOW
      const userRes = await query(
        'SELECT id, email, username, whatsapp, role, password_hash, is_active FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
        [loginId]
      );

      if (userRes.rows.length === 0) {
        return { error: 'Email atau Password salah!' };
      }

      user = userRes.rows[0] as AuthUser;

      if (user.is_active === false) {
        return { error: 'Akun Anda dinonaktifkan oleh Admin. Silakan hubungi Customer Service.' };
      }

      // Auto-migrate user password if it was registered passwordless (password_hash is null)
      if (user.password_hash === null) {
        const hashed = await hashPassword(password!);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, user.id]);
        user.password_hash = hashed;
      }

      // Check password hash
      if (!password || !user.password_hash) {
        return { error: 'Email atau Password salah!' };
      }
      const match = await comparePassword(password, user.password_hash);
      if (!match) {
        return { error: 'Email atau Password salah!' };
      }
    } else {
      const email = loginId;

      // 2. REGISTER FLOW
      if (!whatsapp) {
        return { error: 'Nomor WhatsApp wajib diisi untuk pendaftaran!' };
      }

      // Check if email or whatsapp already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1 OR whatsapp = $2',
        [email, whatsapp]
      );

      if (existingUser.rows.length > 0) {
        return { error: 'Email atau Nomor WhatsApp sudah terdaftar! Silakan Masuk.' };
      }

      const usernameRaw = formData.get('username')?.toString().trim().toLowerCase() || '';
      if (usernameRaw) {
        if (!/^[a-z0-9._-]{3,80}$/.test(usernameRaw)) {
          return { error: 'Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip, minimal 3 karakter.' };
        }
        const usernameTaken = await query(
          'SELECT id FROM users WHERE LOWER(username) = $1',
          [usernameRaw]
        );
        if (usernameTaken.rows.length > 0) {
          return { error: 'Username sudah digunakan. Silakan pilih yang lain.' };
        }
      }

      const referralCode = formData.get("referral_code")?.toString().trim().toUpperCase() || null;
      const selfRefCode = "GPRO-" + Math.random().toString(36).substring(2, 7).toUpperCase();
      
      let referredByUserId = null;
      let refereeTokenBonus = 0;
      
      if (referralCode) {
        // Check if referral code is valid
        const referrer = await query(
          "SELECT id FROM users WHERE referral_code = $1",
          [referralCode]
        );
        if (referrer.rows.length > 0) {
          referredByUserId = referrer.rows[0].id;
          refereeTokenBonus = 10; // Referee gets +10 tokens
          
          // Reward referrer: +20 tokens and +Rp10.000 cashback
          await query(
            "UPDATE users SET token_limit = token_limit + 20, cashback_balance = cashback_balance + 10000 WHERE id = $1",
            [referredByUserId]
          );
        }
      }

      const hashed = await hashPassword(password);

      const newUser = await query(
        `INSERT INTO users (username, email, whatsapp, nama_lengkap, token_limit, referral_code, referred_by, password_hash, subscription_start, subscription_end, status_langganan, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'free', TRUE)
         RETURNING id, email, whatsapp, role`,
        [usernameRaw || null, email, whatsapp, namaLengkap, 5 + refereeTokenBonus, selfRefCode, referredByUserId, hashed]
      );
      user = newUser.rows[0] as AuthUser;

      if (referredByUserId) {
        // Record referral
        await query(
          `INSERT INTO referrals (referrer_id, referee_id, reward_tokens, cashback_amount)
           VALUES ($1, $2, 20, 10000)`,
          [referredByUserId, user.id]
        );
      }

      // Log audit trail
      await query(
        `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [user.id, "Registrasi Akun", `Registrasi berhasil ${referredByUserId ? 'menggunakan referral ' + referralCode : ''}`, "127.0.0.1"]
      );

      // Trigger Welcome Notifications (Welcome Email & WhatsApp)
      await sendEventNotification("register", { ...user, nama_lengkap: user.nama_lengkap || namaLengkap }, {
        referral_code: selfRefCode
      });
    }

    // Set Session Cookie with default activeContext
    await setDefaultSessionCookie({ id: user.id, role: user.role || 'guru' });

  } catch (err: unknown) {
    console.error('Auth Error:', err);
    return { error: 'Terjadi masalah koneksi pada database lokal Anda.' };
  }

  if (user?.role === 'admin') {
    redirect('/admin');
  } else if (checkoutPlan) {
    redirect(`/dashboard?checkout=${checkoutPlan}`);
  } else {
    redirect('/dashboard');
  }
}
