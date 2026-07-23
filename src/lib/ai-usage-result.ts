/**
 * AI Usage — Standar Provider-Agnostic
 *
 * Semua logic downstream (konversi Poin, pengurangan kuota, ledger)
 * HANYA boleh bergantung pada `AIUsageResult` ini.
 * Tidak ada kode di luar adapter yang membaca struktur response
 * mentah satu provider tertentu.
 */

export interface AIUsageResult {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number; // jika provider punya context caching
  provider: string; // "gemini" | "openai" | "anthropic" | dst
  model: string; // nama model spesifik yang dipakai
}

export interface RawAIResponse {
  text: string;
  usage: AIUsageResult | null;
}

// ============================================
// ADAPTER PER PROVIDER
// ============================================

/**
 * Gemini (@google/generative-ai)
 * usageMetadata.promptTokenCount + candidatesTokenCount
 * (+ cachedContentTokenCount bila ada)
 */
export function adaptGeminiUsage(
  usageMetadata: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
  } | null | undefined,
  model: string
): AIUsageResult {
  return {
    inputTokens: usageMetadata?.promptTokenCount || 0,
    outputTokens: usageMetadata?.candidatesTokenCount || 0,
    cachedTokens: usageMetadata?.cachedContentTokenCount || 0,
    provider: "gemini",
    model: model || "unknown",
  };
}

/**
 * OpenAI (chat/completions)
 * data.usage.prompt_tokens + completion_tokens
 * (+ prompt_tokens_details.cached_tokens bila ada)
 */
export function adaptOpenAIUsage(
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  } | null | undefined,
  model: string
): AIUsageResult {
  return {
    inputTokens: usage?.prompt_tokens || 0,
    outputTokens: usage?.completion_tokens || 0,
    cachedTokens: usage?.prompt_tokens_details?.cached_tokens || 0,
    provider: "openai",
    model: model || "unknown",
  };
}

/**
 * Anthropic Claude (messages)
 * data.usage.input_tokens + output_tokens
 * (+ cache_read_input_tokens bila ada)
 */
export function adaptClaudeUsage(
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  } | null | undefined,
  model: string
): AIUsageResult {
  return {
    inputTokens: usage?.input_tokens || 0,
    outputTokens: usage?.output_tokens || 0,
    cachedTokens: usage?.cache_read_input_tokens || 0,
    provider: "anthropic",
    model: model || "unknown",
  };
}

/**
 * DeepSeek (OpenAI-compatible chat/completions)
 * data.usage.prompt_tokens + completion_tokens
 * (+ prompt_tokens_details.cached_tokens bila ada)
 */
export function adaptDeepSeekUsage(
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  } | null | undefined,
  model: string
): AIUsageResult {
  return {
    inputTokens: usage?.prompt_tokens || 0,
    outputTokens: usage?.completion_tokens || 0,
    cachedTokens: usage?.prompt_tokens_details?.cached_tokens || 0,
    provider: "deepseek",
    model: model || "unknown",
  };
}

/**
 * Fallback saat provider tidak mengembalikan usage (mis. mock mode).
 * Mengembalikan usage null agar caller bisa fallback ke estimasi.
 */
export function adaptUnknownUsage(model: string, provider = "unknown"): AIUsageResult {
  return { inputTokens: 0, outputTokens: 0, cachedTokens: 0, provider, model: model || "unknown" };
}
