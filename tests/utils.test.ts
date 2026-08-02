import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  cn,
  toLocalDateString,
  parseLocalDate,
  formatDate,
  formatDateTime,
  formatTime,
  formatRupiah,
  truncate,
  debounce,
  getSemesterFromDate,
  getCurrentAcademicYear,
  isValidEmail,
  isValidWhatsApp,
  generateReferralCode,
} from '@/lib/utils'

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar')
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('p-2 p-4')).toBe('p-4')
  })
})

describe('toLocalDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = new Date(2025, 0, 15)
    expect(toLocalDateString(date)).toBe('2025-01-15')
  })

  it('pads single digit month and day', () => {
    const date = new Date(2025, 0, 5)
    expect(toLocalDateString(date)).toBe('2025-01-05')
  })

  it('uses current date when no argument provided', () => {
    const result = toLocalDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD to local midnight', () => {
    const date = parseLocalDate('2025-01-15')
    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(15)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
  })

  it('handles single digit month and day', () => {
    const date = parseLocalDate('2025-1-5')
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(5)
  })

  it('handles invalid input gracefully', () => {
    const date = parseLocalDate('invalid')
    expect(date).toBeInstanceOf(Date)
  })
})

describe('formatDate', () => {
  it('formats date to Indonesian locale', () => {
    const result = formatDate('2025-01-15')
    expect(result).toMatch(/\d+ \w+ \d+/)
  })

  it('handles Date object', () => {
    const result = formatDate(new Date(2025, 0, 15))
    expect(result).toMatch(/\d+ \w+ \d+/)
  })

  it('accepts custom options', () => {
    const result = formatDate('2025-01-15', { year: 'numeric', month: 'long', day: 'numeric' })
    expect(result).toContain('2025')
    expect(result).toContain('Januari')
  })
})

describe('formatDateTime', () => {
  it('formats datetime to Indonesian locale', () => {
    const result = formatDateTime('2025-01-15T10:30:00')
    expect(result).toMatch(/\d+ \w+ \d+, \d{2}\.\d{2}/)
  })

  it('handles Date object', () => {
    const result = formatDateTime(new Date(2025, 0, 15, 10, 30))
    expect(result).toMatch(/\d+ \w+ \d+, \d{2}\.\d{2}/)
  })
})

describe('formatTime', () => {
  it('formats time to Indonesian locale', () => {
    const result = formatTime('2025-01-15T10:30:00')
    expect(result).toMatch(/\d{2}\.\d{2}/)
  })

  it('handles Date object', () => {
    const result = formatTime(new Date(2025, 0, 15, 10, 30))
    expect(result).toMatch(/\d{2}\.\d{2}/)
  })
})

describe('formatRupiah', () => {
  it('formats number as IDR currency', () => {
    expect(formatRupiah(10000)).toMatch(/Rp\s*10\.000/)
    expect(formatRupiah(1500000)).toMatch(/Rp\s*1\.500\.000/)
    expect(formatRupiah(0)).toMatch(/Rp\s*0/)
  })

  it('handles decimal numbers', () => {
    expect(formatRupiah(10000.50)).toMatch(/Rp\s*10\.000/)
  })
})

describe('truncate', () => {
  it('returns original text if shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates text and adds ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello wo...')
  })

  it('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })
})

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays function execution', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)
    
    debouncedFn('arg1')
    expect(fn).not.toHaveBeenCalled()
    
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('only calls latest invocation', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)
    
    debouncedFn('arg1')
    debouncedFn('arg2')
    debouncedFn('arg3')
    
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg3')
  })

  it('clears previous timeout', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)
    
    debouncedFn('arg1')
    vi.advanceTimersByTime(50)
    debouncedFn('arg2')
    vi.advanceTimersByTime(50)
    
    expect(fn).not.toHaveBeenCalled()
    
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg2')
  })
})

describe('getSemesterFromDate', () => {
  it('returns ganjil for July-December', () => {
    expect(getSemesterFromDate(new Date(2025, 6, 1))).toBe('ganjil') // July
    expect(getSemesterFromDate(new Date(2025, 11, 31))).toBe('ganjil') // December
  })

  it('returns genap for January-June', () => {
    expect(getSemesterFromDate(new Date(2025, 0, 1))).toBe('genap') // January
    expect(getSemesterFromDate(new Date(2025, 5, 30))).toBe('genap') // June
  })
})

describe('getCurrentAcademicYear', () => {
  it('returns correct academic year for July-December', () => {
    const originalDate = global.Date
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(2025, 6, 15) // July 2025
        } else {
          super(...args)
        }
      }
    } as any
    
    expect(getCurrentAcademicYear()).toBe('2025/2026')
    
    global.Date = originalDate
  })

  it('returns correct academic year for January-June', () => {
    const originalDate = global.Date
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(2025, 0, 15) // January 2025
        } else {
          super(...args)
        }
      }
    } as any
    
    expect(getCurrentAcademicYear()).toBe('2024/2025')
    
    global.Date = originalDate
  })
})

describe('isValidEmail', () => {
  it('returns true for valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.id')).toBe(true)
    expect(isValidEmail('user+tag@example.org')).toBe(true)
  })

  it('returns false for invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('missing@domain')).toBe(false)
    expect(isValidEmail('@nodomain.com')).toBe(false)
    expect(isValidEmail('spaces in@email.com')).toBe(false)
  })
})

describe('isValidWhatsApp', () => {
  it('returns true for valid WhatsApp numbers', () => {
    expect(isValidWhatsApp('+6281234567890')).toBe(true)
    expect(isValidWhatsApp('081234567890')).toBe(true)
    expect(isValidWhatsApp('628123456789')).toBe(true)
  })

  it('returns false for invalid WhatsApp numbers', () => {
    expect(isValidWhatsApp('123')).toBe(false)
    expect(isValidWhatsApp('abc')).toBe(false)
    expect(isValidWhatsApp('')).toBe(false)
  })
})

describe('generateReferralCode', () => {
  it('generates code with GPRO- prefix', () => {
    const code = generateReferralCode()
    expect(code).toMatch(/^GPRO-[A-Z0-9]{5}$/)
  })

  it('generates unique codes', () => {
    const codes = new Set()
    for (let i = 0; i < 100; i++) {
      codes.add(generateReferralCode())
    }
    expect(codes.size).toBe(100)
  })
})