import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility functions
 */

// Class name merger (using clsx and tailwind-merge like shadcn/ui)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Local date as YYYY-MM-DD (uses local timezone, NOT UTC)
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Parse YYYY-MM-DD into a Date at LOCAL midnight (avoids UTC shift)
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Get user timezone from localStorage (client) or fallback
export function getUserTimezone(): string {
  if (typeof window === 'undefined') return 'Asia/Jakarta'; // SSR fallback
  try {
    const prefs = JSON.parse(localStorage.getItem('gurupro_user_preferences') || '{}');
    return prefs.zonaWaktu || 'Asia/Jakarta';
  } catch { return 'Asia/Jakarta'; }
}

// Format date to Indonesian locale
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions, timeZone?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const tz = timeZone || getUserTimezone();
  return d.toLocaleDateString('id-ID', { timeZone: tz, ...(options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })})
}

// Format datetime with timezone
export function formatDateTime(date: string | Date, timeZone?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const tz = timeZone || getUserTimezone();
  return d.toLocaleString('id-ID', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format time only
export function formatTime(date: string | Date, timeZone?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const tz = timeZone || getUserTimezone();
  return d.toLocaleString('id-ID', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format currency to IDR
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Get semester from date
export function getSemesterFromDate(date: Date): 'ganjil' | 'genap' {
  const month = date.getMonth() + 1 // 1-12
  // Ganjil: July-December (7-12), Genap: January-June (1-6)
  return month >= 7 ? 'ganjil' : 'genap'
}

// Get current academic year
export function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Academic year starts in July
  if (month >= 7) {
    return `${year}/${year + 1}`
  }
  return `${year - 1}/${year}`
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate WhatsApp number
export function isValidWhatsApp(wa: string): boolean {
  const cleaned = wa.replace(/\D/g, '')
  return cleaned.length >= 10 && cleaned.length <= 15
}

// Generate random referral code
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = 'GPRO-'
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}