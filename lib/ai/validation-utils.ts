/**
 * GuruPRO AI Validation Utilities
 * Shared utilities untuk validasi dan sanitasi output AI
 * Wajib digunakan di semua fitur AI generation (bukan bikin validasi manual)
 *
 * Reference: docs/ai-generation-standard.md
 *
 * NOTE: Untuk schema validation yang kompleks, gunakan Zod langsung di file schema masing-masing fitur.
 * File ini hanya berisi utility functions untuk text manipulation.
 */

// ============================================
// AI MONITORING (lazy loaded to avoid circular deps)
// ============================================

let monitoringModule: typeof import('./monitoring') | null = null;

function getMonitoring() {
  if (!monitoringModule) {
    try {
      monitoringModule = require('./monitoring');
    } catch {
      // Monitoring not available
    }
  }
  return monitoringModule;
}

/**
 * Track AI output length (with feature context)
 */
export function trackOutput(
  feature: string,
  field: string,
  originalLength: number,
  maxAllowed: number
): void {
  const m = getMonitoring();
  if (m) {
    m.trackAIOutput(feature, {
      field,
      originalLength,
      maxAllowed,
    });
  }
}

// ============================================
// CORE TEXT UTILITIES
// ============================================

/**
 * Potong teks jika melebihi maxLength
 * - Jika teks <= maxLength: return teks asli
 * - Jika teks > maxLength: potong + tambahkan ellipsis
 *
 * @example truncateText("halo dunia", 10) → "halo d..."
 * @example truncateText("short", 10) → "short"
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number,
  ellipsis: string = '...'
): string {
  if (!text) return '';

  const safeText = String(text).trim();
  if (safeText.length <= maxLength) {
    return safeText;
  }

  // Preserve words - don't cut in middle of word if possible
  const truncatedLength = maxLength - ellipsis.length;
  if (truncatedLength <= 0) {
    return ellipsis.slice(0, maxLength);
  }

  // Try to cut at word boundary
  const spaceIndex = safeText.lastIndexOf(' ', truncatedLength);
  if (spaceIndex > truncatedLength * 0.7) {
    // Cut at word boundary if it's not too far back
    return safeText.slice(0, spaceIndex) + ellipsis;
  }

  // Otherwise cut at exact position
  return safeText.slice(0, truncatedLength) + ellipsis;
}

/**
 * Potong berdasarkan jumlah kata
 *
 * @example truncateWords("satu dua tiga empat", 2) → "satu dua..."
 */
export function truncateWords(
  text: string | null | undefined,
  maxWords: number,
  ellipsis: string = '...'
): string {
  if (!text) return '';

  const words = String(text).trim().split(/\s+/);
  if (words.length <= maxWords) {
    return words.join(' ');
  }

  return words.slice(0, maxWords).join(' ') + ellipsis;
}

/**
 * Hapus formatting markdown dari teks
 * - Hapus **bold**, *italic*, # heading, `code`, bullet, dll
 * - Return plain text tanpa formatting
 *
 * @example stripMarkdown("**bold** and *italic*") → "bold and italic"
 */
export function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';

  return String(text)
    // Remove bold/italic
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove headings
    .replace(/^#{1,6}\s+/gm, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    // Remove bullet points at start of line
    .replace(/^[\s]*[-*+]\s+/gm, '')
    // Remove numbered lists at start of line
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove links but keep text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Potong array jika exceeds maxItems
 *
 * @example enforceMaxItems([1,2,3,4,5], 3) → [1,2,3]
 */
export function enforceMaxItems<T>(items: T[], maxItems: number): T[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, maxItems);
}

/**
 * Enforce character limits pada array of objects dengan field tertentu
 *
 * @example
 * const truncatedSoal = enforceArrayFieldLimits(parsed.soal, {
 *   field: 'pertanyaan',
 *   maxLength: 500
 * });
 */
export function enforceArrayFieldLimits<T extends Record<string, unknown>>(
  items: T[],
  options: {
    field: keyof T;
    maxLength: number;
  }
): T[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const value = item[options.field];
    if (typeof value === 'string' && value.length > options.maxLength) {
      return {
        ...item,
        [options.field]: truncateText(value, options.maxLength),
      };
    }
    return item;
  });
}

// ============================================
// AI JSON PARSING HELPERS
// ============================================

/**
 * Parse JSON dari AI dengan cleanup
 * - Hapus markdown fence
 * - Hapus trailing comma
 * - Handle AI yang kadang generate malformed JSON
 */
export function parseAIGeneratedJSON(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let cleanText = rawText.trim();

  // Remove markdown code blocks
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.slice(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.slice(3);
  }

  if (cleanText.endsWith('```')) {
    cleanText = cleanText.slice(0, -3);
  }

  cleanText = cleanText.trim();

  // Handle trailing commas (common AI mistake)
  cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');

  return cleanText;
}

// ============================================
// SANITIZATION
// ============================================

/**
 * Sanitize text untuk output dokumen
 * - Strip markdown
 * - Normalize whitespace
 * - Remove potentially dangerous characters
 */
export function sanitizeForDocument(text: string | null | undefined): string {
  if (!text) return '';

  return stripMarkdown(String(text))
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// ============================================
// PRESET LIMITS
// ============================================

/**
 * Preset limits untuk umum
 * Gunakan ini untuk konsistensi antar fitur
 */
export const PRESET_LIMITS = {
  // Short text (nama, label)
  SHORT: { maxChars: 100 },

  // Medium text (deskripsi singkat)
  MEDIUM: { maxChars: 300 },

  // Long text (deskripsi panjang, narasi)
  LONG: { maxChars: 500 },

  // Very long text (materi, esai)
  VERY_LONG: { maxChars: 1000 },

  // Extra long (uraian lengkap)
  EXTRA_LONG: { maxChars: 2000 },

  // Array items
  MIN_ITEMS: { maxItems: 3 },
  MEDIUM_ITEMS: { maxItems: 5 },
  MAX_ITEMS: { maxItems: 10 },
} as const;

/**
 * Preset fallbacks
 */
export const PRESET_FALLBACKS = {
  TIDAK_TERSEDIA: 'Tidak tersedia',
  DATA_TIDAK_TERSEDIA: 'Data tidak tersedia',
  TIDAK_ADA_DESKRIPSI: 'Tidak ada deskripsi',
  TIDAK_ADA_CATATAN: 'Tidak ada catatan',
  KOSONG: '-',
} as const;

// ============================================
// EXPORTS
// ============================================

export default {
  truncateText,
  truncateWords,
  stripMarkdown,
  enforceMaxItems,
  enforceArrayFieldLimits,
  parseAIGeneratedJSON,
  sanitizeForDocument,
  PRESET_LIMITS,
  PRESET_FALLBACKS,
};
