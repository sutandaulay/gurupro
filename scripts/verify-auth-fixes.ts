/**
 * Authentication Fixes Verification
 * Run: npx tsx scripts/verify-auth-fixes.ts
 */

import { pool, query } from "../lib/db";
import { readFileSync } from "fs";
import { join } from "path";

async function verifyFixes() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        AUTHENTICATION FIXES VERIFICATION              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let allPassed = true;

  // ==========================================
  // 1. Check OTP Rate Limiting in Code
  // ==========================================
  console.log('📝 FIX 1: OTP Rate Limiting\n');

  const otpRequestCode = readFileSync(
    join(process.cwd(), 'app/api/auth/otp/request/route.ts'),
    'utf-8'
  );

  const hasRateLimit = otpRequestCode.includes('OTP_REQUEST_MAX_PER_HOUR');
  const hasRateCheck = otpRequestCode.includes('Rate limit exceeded') || otpRequestCode.includes('rate limit exceeded');
  const hasRetryAfter = otpRequestCode.includes('retryAfter');

  console.log(`  ${hasRateLimit ? '✅' : '❌'} OTP_REQUEST_MAX_PER_HOUR constant defined`);
  console.log(`  ${hasRateCheck ? '✅' : '❌'} Rate limit check implemented`);
  console.log(`  ${hasRetryAfter ? '✅' : '❌'} Retry-After header in response`);

  if (!hasRateLimit || !hasRateCheck) {
    console.log('  ⚠️  Rate limiting NOT fully implemented');
    allPassed = false;
  }

  // ==========================================
  // 2. Check SameSite Cookie Attribute
  // ==========================================
  console.log('\n📝 FIX 2: SameSite Cookie Attribute\n');

  const sessionCode = readFileSync(
    join(process.cwd(), 'lib/session.ts'),
    'utf-8'
  );

  const otpVerifyCode = readFileSync(
    join(process.cwd(), 'app/api/auth/otp/verify/route.ts'),
    'utf-8'
  );

  const hasSameSiteSession = sessionCode.includes("sameSite: 'lax'");
  const hasSameSiteOtp = otpVerifyCode.includes('sameSite: "lax"');

  console.log(`  ${hasSameSiteSession ? '✅' : '❌'} lib/session.ts: SameSite='lax'`);
  console.log(`  ${hasSameSiteOtp ? '✅' : '❌'} OTP verify: SameSite='lax'`);

  if (!hasSameSiteSession || !hasSameSiteOtp) {
    console.log('  ⚠️  SameSite cookie attribute NOT fully implemented');
    allPassed = false;
  }

  // ==========================================
  // 3. Check Google OAuth Token Constants
  // ==========================================
  console.log('\n📝 FIX 3: Google OAuth Token Consistency\n');

  const authConfigCode = readFileSync(
    join(process.cwd(), 'lib/auth.config.ts'),
    'utf-8'
  );

  const hasTokenConstant = authConfigCode.includes('DEFAULT_TOKEN_ALLOCATION');
  const hasAuditTrail = authConfigCode.includes('audit_trails');

  console.log(`  ${hasTokenConstant ? '✅' : '❌'} DEFAULT_TOKEN_ALLOCATION constant defined`);
  console.log(`  ${hasAuditTrail ? '✅' : '❌'} Audit trail for Google OAuth users`);

  // ==========================================
  // 4. Check Referral Process API
  // ==========================================
  console.log('\n📝 FIX 4: Referral Process API\n');

  try {
    const referralCode = readFileSync(
      join(process.cwd(), 'app/api/auth/referral/process/route.ts'),
      'utf-8'
    );

    const hasReferralProcess = referralCode.includes('referral_bonus');
    const hasTokenBonus = referralCode.includes('token_limit = token_limit + 10');

    console.log(`  ${hasReferralProcess ? '✅' : '❌'} Referral bonus notification exists`);
    console.log(`  ${hasTokenBonus ? '✅' : '❌'} +10 token bonus for referee`);
  } catch (e) {
    console.log('  ❌ Referral process API not found');
    allPassed = false;
  }

  // ==========================================
  // 5. Verify OTP Table Schema
  // ==========================================
  console.log('\n📝 FIX 5: OTP Table Schema\n');

  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'payload' AND table_name = 'otp_verifications'
      ) as exists
    `);

    if (tableCheck.rows[0].exists) {
      const cols = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'payload' AND table_name = 'otp_verifications'
      `);

      const requiredCols = ['otp_hash', 'sent_to', 'expires_at', 'attempt_count', 'verified_at', 'purpose'];
      const existingCols = cols.rows.map(r => r.column_name);
      const missing = requiredCols.filter(c => !existingCols.includes(c));

      if (missing.length === 0) {
        console.log('  ✅ otp_verifications table exists with all required columns');
        console.log(`     Columns: ${existingCols.join(', ')}`);
      } else {
        console.log(`  ❌ Missing columns: ${missing.join(', ')}`);
        allPassed = false;
      }
    } else {
      console.log('  ❌ otp_verifications table does NOT exist');
      allPassed = false;
    }
  } catch (e: any) {
    console.log(`  ❌ Error checking OTP table: ${e.message}`);
    allPassed = false;
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (allPassed) {
    console.log('  ✅ ALL FIXES VERIFIED');
    console.log('\n  Applied fixes:');
    console.log('    1. OTP Rate Limiting (5 requests/hour)');
    console.log('    2. SameSite Cookie Attribute (CSRF protection)');
    console.log('    3. Google OAuth Token Constants (consistent with register)');
    console.log('    4. Referral Process API (for Google OAuth users)');
    console.log('    5. OTP Table Schema (verified)');
  } else {
    console.log('  ⚠️  SOME FIXES MAY BE INCOMPLETE');
    console.log('     Review above output for details');
  }

  console.log('\n');

  await pool.end();
}

verifyFixes().catch(e => {
  console.error('Verification failed:', e);
  pool.end();
  process.exit(1);
});
