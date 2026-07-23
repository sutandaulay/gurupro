/**
 * GuruPRO Billing Configuration
 *
 * Konstanta konversi dan konfigurasi untuk sistem Poin
 * Semua rasio dan konfigurasi billing terpusat di sini
 */

// ============================================
// KONSTANTA KONVERSI
// ============================================

/**
 * Rasio konversi DEFAULT dari token mentah ke Poin.
 * NILAI INI HANYA FALLBACK — nilai sebenarnya diambil dari
 * setting admin dashboard `tokens_per_poin` (system_settings),
 * di-cache di memory, dan di-invalidate saat admin mengubahnya.
 * JANGAN hardcode rasio di banyak tempat.
 */
export const DEFAULT_TOKENS_PER_POIN = 2000;

/**
 * Minimum Poin yang terpotong per pemakaian AI
 * Mesmo jika hasil hitung < 1 Poin, tetap potong 1 Poin
 */
export const MIN_POIN_PER_USAGE = 1;

/**
 * Rasio cached token (untuk context caching Gemini)
 * Cached tokens jauh lebih murah - charge 10% dari token normal
 */
export const CACHED_TOKEN_RATIO = 0.1;

// ============================================
// GEMINI PRICING (untuk estimasi biaya)
// ============================================

export const GEMINI_PRICING = {
  // Harga per 1 juta token (USD) - Gemini 2.5 Flash-Lite
  inputPerMillion: 0.035,
  outputPerMillion: 0.05,
  // Harga cached content (lebih murah)
  cachedInputPerMillion: 0.0175, // 50% discount
} as const;

// ============================================
// KONVERSI FUNCTIONS
// ============================================

/**
 * Konversi total token mentah ke Poin
 * - Menggunakan Math.ceil untuk pembulatan ke atas
 * - Minimum 1 Poin per pemakaian meskipun hasil hitung < 1
 *
 * @param totalTokens - Total token dari AIUsageResult (input + output)
 * @param tokensPerPoin - Rasio dari cache setting admin (DEFAULT_TOKENS_PER_POIN sebagai fallback)
 * @returns Jumlah Poin yang perlu dipotong
 */
export function convertTokensToPoin(totalTokens: number, tokensPerPoin: number = DEFAULT_TOKENS_PER_POIN): number {
  const ratio = Number(tokensPerPoin) > 0 ? Number(tokensPerPoin) : DEFAULT_TOKENS_PER_POIN;
  if (!totalTokens || totalTokens <= 0) {
    return MIN_POIN_PER_USAGE;
  }
  return Math.max(MIN_POIN_PER_USAGE, Math.ceil(totalTokens / ratio));
}

/**
 * Hitung total token dengan mempertimbangkan cached content
 * Gemini context caching membuat cached tokens jauh lebih murah
 *
 * @param usageMetadata - Usage metadata dari Gemini response
 * @returns Total token efektif untuk dihitung ke Poin
 */
export function calculateEffectiveTokens(usageMetadata: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
}): number {
  const promptTokens = usageMetadata.promptTokenCount || 0;
  const outputTokens = usageMetadata.candidatesTokenCount || 0;
  const cachedTokens = usageMetadata.cachedContentTokenCount || 0;

  // Cached tokens di-charge dengan diskon
  const effectivePromptTokens = cachedTokens * CACHED_TOKEN_RATIO +
                                (promptTokens - cachedTokens);

  return Math.ceil(effectivePromptTokens + outputTokens);
}

/**
 * Estimasi biaya dalam IDR berdasarkan usage
 *
 * @param usage - Usage metadata dari Gemini
 * @param exchangeRate - Kurs USD ke IDR (default 16500)
 * @returns Estimasi biaya dalam IDR
 */
export function estimateCostIdr(
  usage: { inputTokens: number; outputTokens: number; cachedTokens?: number },
  exchangeRate: number = 16500
): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCost = (usage.inputTokens / 1_000_000) *
                    GEMINI_PRICING.inputPerMillion * exchangeRate;

  const outputCost = (usage.outputTokens / 1_000_000) *
                    GEMINI_PRICING.outputPerMillion * exchangeRate;

  return {
    inputCost: Math.round(inputCost),
    outputCost: Math.round(outputCost),
    totalCost: Math.round(inputCost + outputCost),
  };
}

// ============================================
// POIN AMOUNT CONSTANTS
// ============================================

/**
 * Default poin untuk paket gratis (per bulan)
 */
export const DEFAULT_FREE_PLAN_POIN = 10;

/**
 * Minimum poin untuk add-on purchase
 */
export const MIN_ADDON_POIN = 1;

/**
 * Grace period untuk add-on dalam hari
 */
export const ADDON_GRACE_PERIOD_DAYS = 14;

// ============================================
// TYPE EXPORTS
// ============================================

export type PoinDeductionResult = {
  success: boolean;
  poinDeducted: number;
  remainingPoin: number;
  rawTokens: number;
  source: 'main' | 'addon';
};

export type PoinTransaction = {
  id: string;
  userId: string;
  feature: string;
  rawTokens: number;
  poinDeducted: number;
  source: 'main' | 'addon';
  timestamp: Date;
  model?: string;
  provider?: string;
  success: boolean;
  errorMessage?: string;
};
