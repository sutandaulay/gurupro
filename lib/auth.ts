import bcrypt from "bcrypt";

// Re-export authOptions from auth.config.ts for backwards compatibility
// (several API routes import authOptions from '@/lib/auth')
export { authOptions } from "./auth.config";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
