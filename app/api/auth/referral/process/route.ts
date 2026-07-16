import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

async function getUserId() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');
  const session = JSON.parse(sessionCookie);
  return session.id;
}

/**
 * POST /api/auth/referral/process
 * Process a referral code for a user who registered via Google OAuth
 * Body: { referralCode: string }
 *
 * Rewards:
 * - Referrer: +20 token, +10.000 cashback
 * - Referee (new user): +10 token bonus
 */
export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    const body = await request.json();
    const { referralCode, referral_code } = body;
    const cleanCode = (referralCode || referral_code || "").trim().toUpperCase();

    if (!cleanCode) {
      return NextResponse.json({ error: 'Kode referral diperlukan' }, { status: 400 });
    }

    // 1. Check if user already has a referrer
    const userCheck = await query(
      'SELECT referred_by FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    if (userCheck.rows[0].referred_by) {
      return NextResponse.json({
        error: 'Anda sudah menggunakan kode referral sebelumnya',
        alreadyReferred: true
      }, { status: 409 });
    }

    // 2. Find referrer by referral code
    const referrer = await query(
      'SELECT id FROM users WHERE referral_code = $1',
      [cleanCode]
    );

    if (referrer.rows.length === 0) {
      return NextResponse.json({ error: 'Kode referral tidak valid' }, { status: 404 });
    }

    const referrerId = referrer.rows[0].id;

    // Prevent self-referral
    if (referrerId === userId) {
      return NextResponse.json({ error: 'Tidak bisa menggunakan kode referral sendiri' }, { status: 400 });
    }

    // 3. Credit referrer: +20 tokens + 10.000 cashback
    await query(
      'UPDATE users SET token_limit = token_limit + 20, cashback_balance = cashback_balance + 10000 WHERE id = $1',
      [referrerId]
    );

    // 4. Credit referee (current user): +10 tokens bonus
    await query(
      'UPDATE users SET referred_by = $1, token_limit = token_limit + 10 WHERE id = $2',
      [referrerId, userId]
    );

    // 5. Record referral
    await query(
      `INSERT INTO referrals (referrer_id, referee_id, reward_tokens, cashback_amount)
       VALUES ($1, $2, 20, 10000)`,
      [referrerId, userId]
    );

    // 6. Audit trail
    await query(
      `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'Referral Digunakan', `Menggunakan kode referral ${cleanCode}`, '127.0.0.1']
    );

    // 7. Notify referrer (optional)
    try {
      await query(
        `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          referrerId,
          'Bonus Referral! 🎉',
          `Seseorang menggunakan kode referral Anda dan langsung terdaftar. Anda mendapat +20 token & Rp10.000 cashback!`,
          'success',
          'referral_bonus',
          String(userId),
        ]
      );
    } catch { /* notification is non-critical */ }

    return NextResponse.json({
      success: true,
      message: 'Kode referral berhasil diproses!',
      rewards: {
        refereeBonus: 10,
        referrerTokens: 20,
        referrerCashback: 10000
      }
    });

  } catch (error: any) {
    console.error('Process referral error:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
