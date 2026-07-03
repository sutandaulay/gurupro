/**
 * Utility functions
 */

// Class name merger (like clsx but simpler)
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Format date to Indonesian locale
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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