/**
 * Script untuk membuat user Administrator
 * Usage: npx tsx scripts/create-admin.ts
 */

import bcrypt from "bcrypt";
import { pool } from "../lib/db";

const SALT_ROUNDS = 10;

async function createAdminUser() {
  // Konfigurasi user admin
  const adminConfig = {
    email: "admin@gurupro.id",
    password: "GuruAdmin2024!",
    nama_lengkap: "Administrator",
    whatsapp: "+6281234567890",
    username: "admin",
  };

  console.log("🔧 Membuat user Administrator...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Email:    ${adminConfig.email}`);
  console.log(`Username: ${adminConfig.username}`);
  console.log(`Password: ${adminConfig.password}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // Generate password hash
    const passwordHash = await bcrypt.hash(adminConfig.password, SALT_ROUNDS);
    console.log("✅ Password hash generated");

    // Check if admin already exists
    const existing = await pool.query(
      "SELECT id, email FROM users WHERE email = $1 OR username = $2",
      [adminConfig.email, adminConfig.username]
    );

    if (existing.rows.length > 0) {
      console.log("⚠️  User admin sudah ada di database!");
      console.log(`   User ID: ${existing.rows[0].id}`);

      // Update existing user to be admin
      await pool.query(
        `UPDATE users SET
          password_hash = $1,
          nama_lengkap = $2,
          whatsapp = $3,
          role = 'admin',
          is_active = TRUE,
          email_verified = TRUE,
          phone_verified = TRUE
        WHERE email = $4 OR username = $5`,
        [passwordHash, adminConfig.nama_lengkap, adminConfig.whatsapp, adminConfig.email, adminConfig.username]
      );
      console.log("✅ User admin berhasil diupdate!");
    } else {
      // Generate referral code
      const referralCode = "GPRO-" + Math.random().toString(36).substring(2, 7).toUpperCase();

      // Insert new admin user
      const result = await pool.query(
        `INSERT INTO users (
          username, email, whatsapp, nama_lengkap,
          password_hash, role, token_limit, referral_code,
          subscription_start, subscription_end, status_langganan,
          is_active, email_verified, phone_verified, account_type
        )
        VALUES ($1, $2, $3, $4, $5, 'admin', 9999, $6,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '365 days', 'premium',
          TRUE, TRUE, TRUE, 'individual')
        RETURNING id, email`,
        [
          adminConfig.username,
          adminConfig.email,
          adminConfig.whatsapp,
          adminConfig.nama_lengkap,
          passwordHash,
          referralCode,
        ]
      );

      console.log("✅ User admin berhasil dibuat!");
      console.log(`   User ID: ${result.rows[0].id}`);
      console.log(`   Referral Code: ${referralCode}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 KREDENSIAL ADMIN:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🔗 URL Login: http://localhost:3000/login`);
    console.log(`📧 Email:    ${adminConfig.email}`);
    console.log(`🔑 Password: ${adminConfig.password}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("⚠️  GANTI PASSWORD INI SETELAH LOGIN!");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdminUser();
