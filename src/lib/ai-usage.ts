/**
 * AI Usage Extractor Utility
 *
 * Helper untuk extract usage_metadata dari berbagai response AI
 * dan menghitung Poin yang perlu dipotong
 */

import {
  calculateEffectiveTokens,
  convertTokensToPoin,
  TOKENS_PER_POIN,
  MIN_POIN_PER_USAGE,
} from '@/src/config/billing';

/**
 * Usage metadata interface - sesuai dengan format Gemini response
 */
export interface AIUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
}

/**
 * Result dari extraction - siap untuk Poin deduction
 */
export interface PoinCalculationResult {
  rawTokens: number;
  poinNeeded: number;
  breakdown: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    effectiveInputTokens: number;
  };
}

/**
 * Extract dan hitung Poin dari Gemini response
 *
 * @param geminiResponse - Response dari Gemini API
 * @returns PoinCalculationResult dengan breakdown lengkap
 */
export function extractGeminiUsage(geminiResponse: any): PoinCalculationResult {
  // Ambil usage_metadata dari response
  const usage = geminiResponse?.response?.usageMetadata ||
                geminiResponse?.usageMetadata ||
                {};

  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;
  const cachedTokens = usage.cachedContentTokenCount || 0;

  // Hitung effective tokens dengan cached token discount
  const effectiveInputTokens = calculateEffectiveTokens({
    promptTokenCount: inputTokens,
    candidatesTokenCount: outputTokens,
    cachedContentTokenCount: cachedTokens,
  });

  const rawTokens = effectiveInputTokens;
  const poinNeeded = convertTokensToPoin(rawTokens);

  return {
    rawTokens,
    poinNeeded,
    breakdown: {
      inputTokens,
      outputTokens,
      cachedTokens,
      effectiveInputTokens,
    },
  };
}

/**
 * Hitung Poin dari token counts (tanpa response object)
 *
 * @param inputTokens - Token input (prompt)
 * @param outputTokens - Token output (response)
 * @param cachedTokens - Cached tokens (jika ada context caching)
 * @returns PoinCalculationResult
 */
export function calculatePoinFromTokens(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): PoinCalculationResult {
  const effectiveInputTokens = calculateEffectiveTokens({
    promptTokenCount: inputTokens,
    candidatesTokenCount: outputTokens,
    cachedContentTokenCount: cachedTokens,
  });

  const rawTokens = effectiveInputTokens;
  const poinNeeded = convertTokensToPoin(rawTokens);

  return {
    rawTokens,
    poinNeeded,
    breakdown: {
      inputTokens,
      outputTokens,
      cachedTokens,
      effectiveInputTokens,
    },
  };
}

/**
 * Helper untuk estimate Poin sebelum generation
 * Digunakan untuk pre-check apakah user punya Poin cukup
 *
 * @param feature - Nama fitur AI
 * @returns Estimated Poin (untuk budget check)
 */
export function estimateFeaturePoinCost(feature: string): number {
  // Estimasi berdasarkan feature complexity
  const featureEstimates: Record<string, number> = {
    'generate-soal': 2,
    'generate-silabus': 3,
    'generate-atp': 4,
    'generate-prota': 3,
    'generate-modul-ajar': 4,
    'generate-bahan-ajar': 5,
    'generate-lkpd': 2,
    'generate-laporan-evaluasi-lkpd': 3,
    'generate-prosem': 3,
    'generate-administrasi': 2,
    'generate-deskripsi-capaian': 1,
    'ai-journal-generate': 1,
    'ai-rapor-generate': 1,
    'assessments-ai': 2,
    'chatbot': 1,
    'ai-chat': 2,
    'ai-laporan-kinerja': 3,
    'journals-ai': 1,
    'selesai-mengajar': 3,
    'generate-image': 2,
    'regenerate-soal': 1,
    'bahan-ajar': 2,
    'bahan-ajar-refund': 0,
  };

  return featureEstimates[feature] || 2; // Default 2 Poin
}

/**
 * Unit test helpers untuk verifikasi konversi
 */
export const POIN_CONVERSION_TESTS = [
  // [inputTokens, expectedPoin]
  [1, 1],           // Min 1 token = 1 Poin
  [1000, 1],       // < 2000 token = 1 Poin
  [2000, 1],       // Exactly 2000 = 1 Poin
  [2001, 2],       // 2001 token = 2 Poin
  [3999, 2],       // 3999 token = 2 Poin
  [4000, 2],       // Exactly 4000 = 2 Poin
  [4001, 3],       // 4001 token = 3 Poin
  [10000, 5],      // 10000 token = 5 Poin
] as const;

/**
 * Verify konversi sesuai spec
 */
export function verifyPoinConversion(inputTokens: number, expectedPoin: number): boolean {
  const actual = convertTokensToPoin(inputTokens);
  return actual === expectedPoin;
}

/**
 * Run all conversion tests
 */
export function runConversionTests(): { passed: boolean; results: Array<{ input: number; expected: number; actual: number }> } {
  const results: Array<{ input: number; expected: number; actual: number }> = [];
  let allPassed = true;

  for (const [input, expected] of POIN_CONVERSION_TESTS) {
    const actual = convertTokensToPoin(input);
    const passed = actual === expected;
    if (!passed) allPassed = false;
    results.push({ input, expected, actual });
  }

  return { passed: allPassed, results };
}
