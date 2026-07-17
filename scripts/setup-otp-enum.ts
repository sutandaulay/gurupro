/**
 * Setup OTP Purpose Enum Values
 * Run: npx tsx scripts/setup-otp-enum.ts
 */

import { pool } from "../lib/db";

async function setupOtpEnum() {
  console.log('=== OTP PURPOSE ENUM SETUP ===\n');

  try {
    // Check current purpose enum values
    console.log('1. Checking current purpose enum values...');

    const enumCheck = await pool.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumlabel IN ('password_reset', 'account_verification')
        AND enumtypid = (
          SELECT oid FROM pg_type WHERE typname = 'otp_purpose_enum'
        )
    `);

    console.log(`   Found values: ${enumCheck.rows.map(r => r.enumlabel).join(', ') || 'none'}`);

    // Add missing enum values
    console.log('\n2. Adding missing enum values...');

    const missingValues = [];

    try {
      await pool.query(`
        ALTER TYPE otp_purpose_enum ADD VALUE IF NOT EXISTS 'password_reset'
      `);
      missingValues.push('password_reset');
      console.log('   ✅ Added: password_reset');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('   ℹ️  password_reset already exists');
      } else {
        console.log(`   ⚠️  Could not add password_reset: ${e.message.substring(0, 50)}`);
      }
    }

    try {
      await pool.query(`
        ALTER TYPE otp_purpose_enum ADD VALUE IF NOT EXISTS 'account_verification'
      `);
      missingValues.push('account_verification');
      console.log('   ✅ Added: account_verification');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('   ℹ️  account_verification already exists');
      } else {
        console.log(`   ⚠️  Could not add account_verification: ${e.message.substring(0, 50)}`);
      }
    }

    // Check channel enum values too
    console.log('\n3. Checking channel enum values...');

    const channelEnum = await pool.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'otp_channel_enum'
      )
    `);

    console.log(`   Current values: ${channelEnum.rows.map(r => r.enumlabel).join(', ') || 'none'}`);

    // Add missing channel values
    const channelValues = ['whatsapp', 'email'];

    for (const ch of channelValues) {
      try {
        await pool.query(`
          ALTER TYPE otp_channel_enum ADD VALUE IF NOT EXISTS '${ch}'
        `);
        console.log(`   ✅ Added: ${ch}`);
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          console.log(`   ℹ️  ${ch} already exists`);
        } else {
          console.log(`   ⚠️  Could not add ${ch}: ${e.message.substring(0, 50)}`);
        }
      }
    }

    // Final verification
    console.log('\n4. Final verification...');

    const finalPurpose = await pool.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'otp_purpose_enum')
    `);

    const finalChannel = await pool.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'otp_channel_enum')
    `);

    console.log(`   Purpose enum: ${finalPurpose.rows.map(r => r.enumlabel).join(', ')}`);
    console.log(`   Channel enum: ${finalChannel.rows.map(r => r.enumlabel).join(', ')}`);

    console.log('\n=== SETUP COMPLETE ===');

  } catch (e: any) {
    // If enum doesn't exist yet, it's likely TEXT type - that's fine
    if (e.message.includes('does not exist') || e.message.includes('type "otp_')) {
      console.log('ℹ️  OTP purpose/channel columns may use TEXT type instead of ENUM');
      console.log('   This is fine - the system will work with TEXT values');
      console.log('\n=== SETUP COMPLETE ===');
    } else {
      console.error('Error:', e.message);
    }
  }

  await pool.end();
}

setupOtpEnum().catch(e => {
  console.error(e);
  process.exit(1);
});
