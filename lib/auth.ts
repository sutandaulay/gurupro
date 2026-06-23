import crypto from "crypto";

/**
 * Basic SHA-256 password hashing with a static salt for local PostgreSQL setup.
 */
export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "_gurupro_secure_salt_2026")
    .digest("hex");
}
