import crypto from "crypto";
import {
  ALLOWED_DOCUMENT_CATEGORIES,
  OTP_VALIDITY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_RATE_LIMIT_PER_HOUR,
  DOCUMENT_CATEGORY_BLOCKED_KEYWORDS,
} from "@/collections/config";

/**
 * Normalize Indonesian phone number to E.164 format
 * Supports: 08xxx, 62xxx, +62xxx, with/without spaces/dashes
 */
export function normalizePhoneNumber(input: string): string | null {
  if (!input) return null;

  const cleaned = input.replace(/\D/g, "");

  let digits = cleaned;
  if (cleaned.startsWith("62")) {
    digits = cleaned.substring(2);
  } else if (cleaned.startsWith("0")) {
    digits = cleaned.substring(1);
  }

  if (digits.length < 8 || digits.length > 12) {
    return null;
  }

  return `+62${digits}`;
}

/**
 * Validate E.164 phone number format
 */
export function isValidPhoneE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/**
 * Normalize email: lowercase + trim
 */
export function normalizeEmail(input: string): string | null {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return null;
  }
  return normalized;
}

/**
 * Validate if document category is allowed (not financial)
 * This is a critical security check - reject at code level
 */
export function validateDocumentCategory(category: string): {
  valid: boolean;
  reason?: string;
} {
  if (!category) {
    return { valid: false, reason: "Kategori dokumen wajib dipilih" };
  }

  const allowedValues = ALLOWED_DOCUMENT_CATEGORIES.map((c) => c.value);
  if (!allowedValues.includes(category)) {
    return { valid: false, reason: "Kategori tidak valid" };
  }

  const lowerCategory = category.toLowerCase();
  for (const blocked of DOCUMENT_CATEGORY_BLOCKED_KEYWORDS) {
    if (lowerCategory.includes(blocked)) {
      return {
        valid: false,
        reason: `Kategori '${category}' tidak diizinkan karena terkait keuangan`,
      };
    }
  }

  return { valid: true };
}

/**
 * Generate unique share token
 */
export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Generate 6-digit OTP
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP with SHA-256 (never store plain text)
 */
export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Verify OTP against stored hash (timing-safe comparison)
 */
export function verifyOtp(otp: string, storedHash: string): boolean {
  try {
    const inputHash = hashOtp(otp);
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Get OTP expiry date
 */
export function getOtpExpiryDate(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_VALIDITY_MINUTES);
  return expiry;
}

/**
 * Check if OTP has exceeded max attempts
 */
export function isOtpMaxAttemptsReached(attemptCount: number): boolean {
  return attemptCount >= OTP_MAX_ATTEMPTS;
}

/**
 * Check if OTP is expired
 */
export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}

/**
 * Generate wa.me link for WhatsApp sharing
 */
export function generateWaMeLink(phoneNumber: string, message: string): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return "";

  const cleanPhone = normalized.replace("+", "");
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Generate default share message for WhatsApp
 */
export function generateShareMessage(
  leaderName: string,
  teacherName: string,
  shareUrl: string
): string {
  return `Bapak/Ibu ${leaderName},

Saya ${teacherName} ingin membagikan ringkasan kinerja mengajar saya melalui GuruPRO AI.

Lihat di sini: ${shareUrl}

Terima kasih.`;
}

/**
 * Calculate share link expiry date
 */
export function getShareLinkExpiryDate(days: number = 30): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Check if share link is expired
 */
export function isShareLinkExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return true;
  return new Date() > new Date(expiresAt);
}

/**
 * Check if share link is revoked
 */
export function isShareLinkRevoked(revokedAt: Date | string | null): boolean {
  if (!revokedAt) return false;
  return new Date() > new Date(revokedAt);
}

/**
 * Get allowed document categories
 */
export function getAllowedDocumentCategories() {
  return ALLOWED_DOCUMENT_CATEGORIES;
}

/**
 * Get OTP rate limit for resend
 */
export function getOtpResendRateLimit(): number {
  return OTP_RESEND_RATE_LIMIT_PER_HOUR;
}
