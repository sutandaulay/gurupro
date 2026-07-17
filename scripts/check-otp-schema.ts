/**
 * Check OTP Schema
 * Run: npx tsx scripts/check-otp-schema.ts
 */

import { pool } from "../lib/db";

async function checkOtpSchema() {
  console.log('=== OTP VERIFICATIONS SCHEMA CHECK ===\n');

  try {
    // Check if table exists
    const tableExists = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'payload' AND table_name = 'otp_verifications'
      ) as exists
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ otp_verifications table does not exist!');
      console.log('   Need to run: npx payload push');
      await pool.end();
      return;
    }

    console.log('✅ otp_verifications table exists\n');

    // Get column info
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'payload'
        AND table_name = 'otp_verifications'
      ORDER BY ordinal_position
    `);

    console.log('Columns:');
    const requiredColumns = [
      'id', 'otp_hash', 'sent_to', 'expires_at',
      'attempt_count', 'verified_at', 'purpose', 'channel'
    ];
    const existingCols = cols.rows.map(r => r.column_name);

    for (const col of cols.rows) {
      const isRequired = requiredColumns.includes(col.column_name);
      console.log(`  ${isRequired ? '✅' : '?'} ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
    }

    // Check for missing required columns
    const missing = requiredColumns.filter(c => !existingCols.includes(c));
    if (missing.length > 0) {
      console.log(`\n⚠️  Missing columns: ${missing.join(', ')}`);
    }

    // Check existing OTP records
    const otpCount = await pool.query('SELECT COUNT(*) FROM payload.otp_verifications');
    console.log(`\nOTP records: ${otpCount.rows[0].count}`);

    // Check recent OTP records
    const recentOtp = await pool.query(`
      SELECT id, channel, sent_to, purpose, expires_at, verified_at, attempt_count
      FROM payload.otp_verifications
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (recentOtp.rows.length > 0) {
      console.log('\nRecent OTP records:');
      for (const row of recentOtp.rows) {
        console.log(`  - ID: ${row.id}`);
        console.log(`    Channel: ${row.channel}`);
        console.log(`    To: ${row.sent_to}`);
        console.log(`    Purpose: ${row.purpose}`);
        console.log(`    Expires: ${row.expires_at}`);
        console.log(`    Verified: ${row.verified_at || 'NOT VERIFIED'}`);
        console.log('');
      }
    }

    // Test OTP hash format
    console.log('=== OTP HASH FORMAT TEST ===');
    const sampleOtp = await pool.query(`
      SELECT otp_hash FROM payload.otp_verifications LIMIT 1
    `);

    if (sampleOtp.rows.length > 0) {
      const hash = sampleOtp.rows[0].otp_hash;
      console.log(`Sample hash length: ${hash?.length || 'NULL'}`);
      console.log(`Sample hash (first 20 chars): ${hash?.substring(0, 20) || 'N/A'}...`);

      // Check if hash is valid hex (64 chars for SHA256)
      if (hash && /^[a-f0-9]{64}$/i.test(hash)) {
        console.log('✅ Hash format is valid SHA256 hex');
      } else if (hash && hash.length === 64) {
        console.log('✅ Hash is 64 chars (SHA256)');
      } else {
        console.log('⚠️  Hash format may be different than expected');
      }
    }

  } catch (e: any) {
    console.error('Error:', e.message);
  }

  await pool.end();
}

checkOtpSchema().catch(console.error);
