/**
 * Bahan Ajar AI Generation Service
 * Layanan untuk generate slide outline, LKPD, dan handout menggunakan Gemini
 *
 * Mengikuti Permendikdasmen No. 1/2026 tentang Standar Proses
 * Token quota check & deduction terintegrasi dengan sistem yang sudah ada
 */

import { generateAIContent } from "./generators";
import { getUserTokenAccess, consumeUserToken } from "../token-system";
import {
  buildSlidePrompt,
  buildLkpdPrompt,
  buildHandoutPrompt,
  buildComplianceCheckPrompt,
  type ModulAjarData,
} from "./bahanAjarPrompts";
import { jsonrepair as repair } from "jsonrepair";

// ============================================
// TYPES
// ============================================

export type JenisOutput = "slides" | "lkpd" | "handout";

export interface ModulAjarContext {
  id?: string;
  nama_modul?: string;
  jenjang: string;
  fase?: string;
  mapel: string;
  kelas?: string;
  cp?: string;
  tp?: string[];
  atp?: {
    pertemuan?: number;
    alur?: Array<{
      minggu?: number;
      topik?: string;
      tujuan?: string[];
      alokasi_waktu?: string;
    }>;
  };
  topik?: string;
  materi_pokok?: string[];
  kurikulum?: string;
  jumlah_pertemuan?: number;
  alokasi_waktu_per_pertemuan?: string;
}

export interface GenerationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  tokenUsed?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface BahanAjarGenerationResult {
  slides?: any;
  lkpd?: any;
  handout?: string;
  complianceCheck?: ComplianceCheckResult;
  tokenUsed: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface ComplianceCheckResult {
  selarasCPTPATP: { status: string; catatan: string };
  mendorongPembelajaranAktif: { status: string; catatan: string };
  mencakupOlahPikirHatiRasaRaga: { status: string; catatan: string };
  bahasaSesuaiFase: { status: string; catatan: string };
  catatan: string;
}

// ============================================
// NEW v2 OUTPUT TYPES
// ============================================

/**
 * v2 Slide Output (new schema)
 */
export interface SlideItem {
  nomor: number;
  jenisSlide: "pembuka" | "tujuan_pembelajaran" | "materi" | "contoh" | "aktivitas" | "rangkuman" | "penutup";
  judulSlide: string;
  kontenPoin: string[];
  catatanPembicara: string | null;
  saranVisual: string | null;
}

export interface SlideOutputV2 {
  judulPresentasi: string;
  slides: SlideItem[];
}

/**
 * v2 Handout Output (new schema)
 */
export interface HandoutSoal {
  soal: string;
  kunciJawaban: string | null;
}

export interface HandoutOutputV2 {
  judul: string;
  ringkasanMateri: string;
  poinPenting: string[];
  contohSoalLatihan: HandoutSoal[];
  referensiTambahan: string[] | null;
}

/**
 * v2 Generation Result (combined)
 */
export interface BahanAjarGenerationResultV2 {
  slidesV2?: SlideOutputV2;
  handoutV2?: HandoutOutputV2;
  complianceCheck?: ComplianceCheckResult;
  tokenUsed: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

// ============================================
// TOKEN COST CONSTANTS
// ============================================

// Estimasi token per jenis output (untuk kalkulasi awal)
// Kalibrasi ulang jika biaya aktual berbeda signifikan
export const TOKEN_ESTIMATES = {
  // Input tokens per prompt
  slidesInput: 800,
  lkpdInput: 900,
  handoutInput: 700,
  complianceInput: 1500,

  // Output tokens per jenis
  slidesOutput: 2000,
  lkpdOutput: 2500,
  handoutOutput: 3000,
  complianceOutput: 500,

  // Proporsi untuk regenerate parsial (%)
  partialRegenerateRatio: {
    slides: 0.4,
    lkpd: 0.5,
    handout: 0.45,
  },
} as const;

// ============================================
// TOKEN ESTIMATION
// ============================================

/**
 * Estimate total token cost untuk generation yang diminta
 */
export function estimateTotalTokenCost(
  jenisOutput: JenisOutput[],
  jumlahPertemuan: number
): {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  breakdown: Record<string, { input: number; output: number; total: number }>;
} {
  const breakdown: Record<string, { input: number; output: number; total: number }> = {};

  let totalInput = 0;
  let totalOutput = 0;

  for (const jenis of jenisOutput) {
    let inputEst = 0;
    let outputEst = 0;

    switch (jenis) {
      case "slides":
        inputEst = TOKEN_ESTIMATES.slidesInput;
        outputEst = TOKEN_ESTIMATES.slidesOutput * Math.ceil(jumlahPertemuan / 2);
        break;
      case "lkpd":
        inputEst = TOKEN_ESTIMATES.lkpdInput;
        outputEst = TOKEN_ESTIMATES.lkpdOutput * Math.ceil(jumlahPertemuan / 2);
        break;
      case "handout":
        inputEst = TOKEN_ESTIMATES.handoutInput;
        outputEst = TOKEN_ESTIMATES.handoutOutput;
        break;
    }

    breakdown[jenis] = { input: inputEst, output: outputEst, total: inputEst + outputEst };
    totalInput += inputEst;
    totalOutput += outputEst;
  }

  // Compliance check di akhir (sekali saja)
  const complianceInput = TOKEN_ESTIMATES.complianceInput;
  const complianceOutput = TOKEN_ESTIMATES.complianceOutput;
  totalInput += complianceInput;
  totalOutput += complianceOutput;

  return {
    estimatedInputTokens: totalInput,
    estimatedOutputTokens: totalOutput,
    estimatedTotalTokens: totalInput + totalOutput,
    breakdown,
  };
}

/**
 * Estimate token untuk regenerate parsial
 */
export function estimatePartialTokenCost(
  jenis: JenisOutput,
  _jenisSisa: JenisOutput[]
): {
  estimatedTokens: number;
  isPartial: boolean;
} {
  // Calculate based on single jenis output, not combined
  let fullCost = 0;
  switch (jenis) {
    case "slides":
      fullCost = TOKEN_ESTIMATES.slidesInput + TOKEN_ESTIMATES.slidesOutput;
      break;
    case "lkpd":
      fullCost = TOKEN_ESTIMATES.lkpdInput + TOKEN_ESTIMATES.lkpdOutput;
      break;
    case "handout":
      fullCost = TOKEN_ESTIMATES.handoutInput + TOKEN_ESTIMATES.handoutOutput;
      break;
  }

  const ratio = TOKEN_ESTIMATES.partialRegenerateRatio[jenis] || 0.5;
  const partialEstimate = Math.ceil(fullCost * ratio);

  return {
    estimatedTokens: partialEstimate,
    isPartial: true,
  };
}

// ============================================
// TOKEN QUOTA MANAGEMENT
// ============================================

/**
 * Check dan prepare token deduction sebelum generation
 */
async function prepareTokenDeduction(
  userId: string,
  estimatedTokens: number
): Promise<{
  allowed: boolean;
  remainingTokens: number;
  error?: string;
}> {
  // Check user token access
  const { access, user } = await getUserTokenAccess(userId);

  if (!access.allowed) {
    return {
      allowed: false,
      remainingTokens: 0,
      error: `Token tidak tersedia: ${access.reason === "token_habis" ? "Kuota habis" : access.reason === "subscription_expired" ? "Langganan expired" : "Akses ditolak"}`,
    };
  }

  const remaining = access.remainingTokens || 0;

  // Grace period check: user dengan subscription aktif tapi token habis
  // tetap boleh generate (akan di-track untuk top-up reminder)
  if (remaining < estimatedTokens) {
    // Jika subscription masih aktif, boleh lanjut tapi catat defisit
    const subscriptionEnd = user?.subscription_end;
    const isActiveSubscription =
      subscriptionEnd && new Date(subscriptionEnd) > new Date();

    if (!isActiveSubscription) {
      return {
        allowed: false,
        remainingTokens: remaining,
        error: `Token tidak cukup. Diperlukan: ${estimatedTokens}, Tersedia: ${remaining}`,
      };
    }
  }

  return {
    allowed: true,
    remainingTokens: remaining,
  };
}

/**
 * Deduct tokens dengan tracking dan error handling
 */
async function deductAndTrack(
  userId: string,
  actualTokens: number,
  context: {
    jenisOutput: JenisOutput[];
    modulId?: string;
    isPartial?: boolean;
  }
): Promise<void> {
  try {
    await consumeUserToken(userId, actualTokens);
    console.log(`[BahanAjar] Token deducted: ${actualTokens} for user ${userId}`, {
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log error tapi jangan throw - generation sudah sukses
    console.error("[BahanAjar] Token deduction failed:", error, {
      userId,
      actualTokens,
      context,
    });
  }
}

/**
 * Refund tokens jika generation gagal di tengah jalan
 */
async function refundTokens(
  userId: string,
  tokensToRefund: number,
  reason: string
): Promise<void> {
  // Token system tidak ada refund function, jadi kita log sebagai credit
  // Untuk implementasi lengkap, bisa add grantUserTokens sebagai "refund"
  console.warn(`[BahanAjar] Refund needed: ${tokensToRefund} tokens for ${userId}. Reason: ${reason}`);
  // TODO: Implementasi refund function jika diperlukan
  // await grantUserTokens(userId, tokensToRefund);
}

// ============================================
// GENERATION SERVICE
// ============================================

/**
 * Generate Bahan Ajar (slides, LKPD, handout) dengan token quota management
 */
export async function generateBahanAjar(
  userId: string,
  modulData: ModulAjarContext,
  jenisOutput: JenisOutput[]
): Promise<BahanAjarGenerationResult> {
  const jumlahPertemuan = modulData.jumlah_pertemuan || modulData.atp?.pertemuan || 4;

  // Step 1: Estimate token cost
  const costEstimate = estimateTotalTokenCost(jenisOutput, jumlahPertemuan);

  // Step 2: Check token quota
  const quotaCheck = await prepareTokenDeduction(userId, costEstimate.estimatedTotalTokens);
  if (!quotaCheck.allowed) {
    throw new Error(quotaCheck.error);
  }

  // Step 3: Generate outputs
  const result: BahanAjarGenerationResult = {
    tokenUsed: 0,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };

  const generatedContent: Record<string, any> = {};
  let accumulatedTokens = 0;

  try {
    // Generate slides
    if (jenisOutput.includes("slides")) {
      const slidesResult = await generateSlides(modulData);
      if (slidesResult.success && slidesResult.data) {
        result.slides = slidesResult.data;
        generatedContent.slides = slidesResult.data;
        accumulatedTokens += costEstimate.breakdown.slides?.total || TOKEN_ESTIMATES.slidesOutput;
      } else {
        throw new Error(slidesResult.error || "Gagal generate slides");
      }
    }

    // Generate LKPD
    if (jenisOutput.includes("lkpd")) {
      const lkpdResult = await generateLkpd(modulData);
      if (lkpdResult.success && lkpdResult.data) {
        result.lkpd = lkpdResult.data;
        generatedContent.lkpd = lkpdResult.data;
        accumulatedTokens += costEstimate.breakdown.lkpd?.total || TOKEN_ESTIMATES.lkpdOutput;
      } else {
        throw new Error(lkpdResult.error || "Gagal generate LKPD");
      }
    }

    // Generate Handout
    if (jenisOutput.includes("handout")) {
      const handoutResult = await generateHandout(modulData);
      if (handoutResult.success && handoutResult.data) {
        result.handout = handoutResult.data;
        generatedContent.handout = handoutResult.data;
        accumulatedTokens += costEstimate.breakdown.handout?.total || TOKEN_ESTIMATES.handoutOutput;
      } else {
        throw new Error(handoutResult.error || "Gagal generate handout");
      }
    }

    // Step 4: Compliance check (selalu di akhir generation penuh)
    const complianceResult = await runComplianceCheck(generatedContent);
    if (complianceResult.success && complianceResult.data) {
      result.complianceCheck = complianceResult.data;
    }
    accumulatedTokens += TOKEN_ESTIMATES.complianceOutput;

    // Step 5: Update usage stats
    result.tokenUsed = accumulatedTokens;
    result.usage = {
      inputTokens: Math.ceil(accumulatedTokens * 0.3), // Estimasi proporsi
      outputTokens: Math.ceil(accumulatedTokens * 0.7),
      totalTokens: accumulatedTokens,
    };

    // Step 6: Deduct tokens
    await deductAndTrack(userId, accumulatedTokens, {
      jenisOutput,
      modulId: modulData.id,
    });

    return result;
  } catch (error: any) {
    // Refund tokens jika gagal di tengah jalan
    if (accumulatedTokens > 0) {
      await refundTokens(userId, accumulatedTokens, error.message);
    }
    throw error;
  }
}

/**
 * Regenerate satu jenis output saja dengan token proporsional
 */
export async function regenerateBahanAjarPartial(
  userId: string,
  modulData: ModulAjarContext,
  jenis: JenisOutput
): Promise<GenerationResult> {
  const jenisSisa: JenisOutput[] = [];
  const partialEstimate = estimatePartialTokenCost(jenis, jenisSisa);

  // Check token quota
  const quotaCheck = await prepareTokenDeduction(userId, partialEstimate.estimatedTokens);
  if (!quotaCheck.allowed) {
    return {
      success: false,
      error: quotaCheck.error,
    };
  }

  let result: GenerationResult = { success: false };

  try {
    switch (jenis) {
      case "slides":
        result = await generateSlides(modulData);
        break;
      case "lkpd":
        result = await generateLkpd(modulData);
        break;
      case "handout":
        result = await generateHandout(modulData);
        break;
    }

    if (result.success) {
      // Deduct proporsional tokens
      const actualTokens = partialEstimate.estimatedTokens;
      await deductAndTrack(userId, actualTokens, {
        jenisOutput: [jenis],
        modulId: modulData.id,
        isPartial: true,
      });
      result.tokenUsed = actualTokens;
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// INTERNAL GENERATORS
// ============================================

async function generateSlides(
  modulData: ModulAjarContext
): Promise<GenerationResult> {
  const prompt = buildSlidePrompt(modulData as ModulAjarData);

  return generateAIContent(
    prompt,
    { slides: [] },
    { temperature: 0.3, maxOutputTokens: 4096 }
  );
}

async function generateLkpd(
  modulData: ModulAjarContext
): Promise<GenerationResult> {
  const prompt = buildLkpdPrompt(modulData as ModulAjarData);

  return generateAIContent(
    prompt,
    { lkpd: [] },
    { temperature: 0.3, maxOutputTokens: 5120 }
  );
}

async function generateHandout(
  modulData: ModulAjarContext
): Promise<GenerationResult<string>> {
  const prompt = buildHandoutPrompt(modulData as ModulAjarData);

  // Handout adalah Markdown, bukan JSON
  return generateAIContent(
    prompt,
    "",
    { temperature: 0.4, maxOutputTokens: 6144 }
  );
}

async function runComplianceCheck(
  content: { slides?: any; lkpd?: any; handout?: string }
): Promise<GenerationResult<ComplianceCheckResult>> {
  const prompt = buildComplianceCheckPrompt(content);

  return generateAIContent(
    prompt,
    {
      selarasCPTPATP: { status: "unknown", catatan: "Compliance check failed" },
      mendorongPembelajaranAktif: { status: "unknown", catatan: "" },
      mencakupOlahPikirHatiRasaRaga: { status: "unknown", catatan: "" },
      bahasaSesuaiFase: { status: "unknown", catatan: "" },
      catatan: "",
    } as ComplianceCheckResult,
    { temperature: 0.1, maxOutputTokens: 1024 }
  );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse JSON response dengan error handling ROBUST
 * Handle trailing commas, unescaped chars, dll dari AI output
 */
export function parseJsonResponse<T>(response: string, fallback: T): T {
  try {
    let cleanResponse = response.trim();

    // Remove markdown code blocks
    if (cleanResponse.startsWith("```json")) {
      cleanResponse = cleanResponse.slice(7);
    } else if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith("```")) {
      cleanResponse = cleanResponse.slice(0, -3);
    }

    cleanResponse = cleanResponse.trim();

    // First try direct parse
    try {
      return JSON.parse(cleanResponse) as T;
    } catch (initialError) {
      // If direct parse fails, try jsonrepair
      try {
        const fixed = repair(cleanResponse);
        return JSON.parse(fixed) as T;
      } catch (repairError) {
        // If jsonrepair fails, try custom fixes
        const customFixed = fixMalformedJson(cleanResponse);
        try {
          return JSON.parse(customFixed) as T;
        } catch (customError) {
          // Try aggressive extraction
          const extracted = extractJsonFromText(cleanResponse);
          if (extracted) {
            try {
              return JSON.parse(extracted) as T;
            } catch (e) {
              // Last try with jsonrepair on extracted
              const repaired = repair(extracted);
              return JSON.parse(repaired) as T;
            }
          }
        }
      }
    }

    console.error("[BahanAjar] All JSON parsing attempts failed");
    return fallback;
  } catch (error) {
    console.error("[BahanAjar] Failed to parse JSON:", error);
    return fallback;
  }
}

/**
 * Extract JSON object or array from text
 */
function extractJsonFromText(text: string): string | null {
  // Try to find JSON object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  // Try to find JSON array
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];

  return null;
}

/**
 * Fix common JSON syntax errors in AI-generated content
 */
function fixMalformedJson(json: string): string {
  let result = json;

  // Fix trailing commas before closing brackets
  result = result.replace(/,(\s*[}\]])/g, '$1');

  // Fix unescaped newlines in strings (very common in AI output)
  // This is tricky - we need to be careful not to break actual newlines in strings
  result = fixUnescapedNewlines(result);

  // Fix single quotes to double quotes for JSON keys
  // Only fix if it looks like it's causing issues
  result = fixSingleQuotes(result);

  // Remove any control characters except newlines and tabs
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Fix multiple commas
  result = result.replace(/,+/g, ',');

  // Fix missing commas between properties
  result = fixMissingCommas(result);

  return result;
}

/**
 * Fix unescaped newlines in JSON strings
 */
function fixUnescapedNewlines(json: string): string {
  const lines = json.split('\n');
  const result: string[] = [];
  let insideString = false;
  let currentLine = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let newLine = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"' && (j === 0 || line[j - 1] !== '\\')) {
        insideString = !insideString;
      }

      // Only allow actual line breaks inside strings if properly escaped
      if (char === '\n' && insideString) {
        // Replace with escaped newline
        newLine += '\\n';
        continue;
      }

      newLine += char;
    }

    // If we're inside a string at end of line, keep it for next line
    if (insideString) {
      currentLine += newLine + ' ';
    } else {
      if (currentLine) {
        result.push(currentLine + newLine);
        currentLine = '';
      } else {
        result.push(newLine);
      }
    }
  }

  if (currentLine) {
    result.push(currentLine);
  }

  return result.join('\n');
}

/**
 * Fix single quotes to double quotes where appropriate
 */
function fixSingleQuotes(json: string): string {
  // Only fix if pattern looks like: "key": 'value'
  // Don't fix inside strings that contain single quotes as content
  let result = '';
  let i = 0;

  while (i < json.length) {
    const char = json[i];

    // If we're at a potential key/value boundary
    if (char === "'" && i > 0) {
      const before = json[i - 1];
      const after = json[i + 1];

      // Check if this is a string delimiter (after : or , with optional space)
      if ((before === ':' || before === ',') && after !== '\\') {
        // Look ahead for closing quote
        let j = i + 1;
        while (j < json.length && json[j] !== "'") {
          if (json[j] === '\\') j++; // Skip escaped chars
          j++;
        }

        // Check what comes after the closing quote
        const afterClose = json[j + 1];
        if (afterClose === ',' || afterClose === '}' || afterClose === ']' || afterClose === '\n' || afterClose === ' ') {
          result += '"';
          i++;

          // Copy content and escape any internal double quotes
          while (i < j) {
            if (json[i] === '"') result += '\\"';
            else result += json[i];
            i++;
          }

          result += '"';
          i++; // Skip closing single quote
          continue;
        }
      }
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Fix missing commas between JSON properties
 */
function fixMissingCommas(json: string): string {
  // Pattern: "key": value\n"next_key"
  // This regex adds comma between properties when missing
  return json.replace(/("\s*:\s*[^,\[{"\n]+)(\s+)(")/g, '$1,$2$3');
}

/**
 * Try more aggressive JSON fixes as fallback
 */
function tryAggressiveJsonFix<T>(response: string, fallback: T): T {
  // Try to extract just the JSON object/array
  const jsonMatch = response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

  if (jsonMatch) {
    let candidate = jsonMatch[1];

    // Aggressive fixes
    candidate = candidate.replace(/,(\s*[}\]])/g, '$1'); // trailing commas
    candidate = candidate.replace(/'/g, '"'); // single to double quotes

    // Try parsing
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // Continue to next attempt
    }
  }

  // Try stripping non-JSON content more aggressively
  const stripped = response
    .replace(/^[^{[]*/, '') // Remove before first { or [
    .replace(/[^}\]]$/, ''); // Remove after last } or ]

  try {
    return JSON.parse(stripped);
  } catch (e) {
    throw new Error('Could not fix JSON');
  }
}

/**
 * Validasi compliance check result
 */
export function isCompliancePassed(
  check: ComplianceCheckResult
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  let passed = true;

  if (check.selarasCPTPATP.status !== "compliant") {
    passed = false;
    issues.push(`CP/TP/ATP: ${check.selarasCPTPATP.catatan}`);
  }

  if (check.mendorongPembelajaranAktif.status === "non-compliant") {
    passed = false;
    issues.push(`Pembelajaran Aktif: ${check.mendorongPembelajaranAktif.catatan}`);
  }

  if (check.mencakupOlahPikirHatiRasaRaga.status === "non-compliant") {
    passed = false;
    issues.push(`4 Dimensi OLAH: ${check.mencakupOlahPikirHatiRasaRaga.catatan}`);
  }

  if (check.bahasaSesuaiFase.status === "non-compliant") {
    passed = false;
    issues.push(`Bahasa/Fase: ${check.bahasaSesuaiFase.catatan}`);
  }

  return { passed, issues };
}

// ============================================
// v2 GENERATION FUNCTIONS
// ============================================

/**
 * Options for v2 generation
 */
export interface GenerateBahanAjarV2Options {
  jenisOutput: ("slides" | "handout")[];
  jumlahSlideTarget?: number;
  gayaVisual?: "minimalis" | "ilustratif" | "akademis";
  handoutVersi?: "guru" | "siswa";
}

/**
 * Generate Bahan Ajar v2 dengan new schema
 * - slides: SlideOutputV2 dengan struktur baru
 * - handout: HandoutOutputV2 dengan versi guru/siswa
 */
export async function generateBahanAjarV2(
  userId: string,
  modulData: ModulAjarContext,
  options: GenerateBahanAjarV2Options
): Promise<BahanAjarGenerationResultV2> {
  const { jenisOutput, jumlahSlideTarget, gayaVisual, handoutVersi } = options;

  const result: BahanAjarGenerationResultV2 = {
    tokenUsed: 0,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };

  // Dynamic imports for v2 prompts
  const { buildSlidePromptV2, buildHandoutPromptV2 } = await import("./bahanAjarPrompts");

  // Generate slides v2
  if (jenisOutput.includes("slides")) {
    const { systemInstruction, userPrompt } = buildSlidePromptV2(modulData as any, {
      jumlahSlideTarget,
      gayaVisual,
    });

    const slidesResult = await generateAIContent<SlideOutputV2>(
      userPrompt,
      { judulPresentasi: "", slides: [] },
      { temperature: 0.3, maxOutputTokens: 4096 }
    );

    if (slidesResult.success && slidesResult.data) {
      result.slidesV2 = slidesResult.data;
      result.tokenUsed += slidesResult.usage?.totalTokens || 500;
      result.usage.inputTokens += Math.ceil((slidesResult.usage?.totalTokens || 500) * 0.3);
      result.usage.outputTokens += Math.ceil((slidesResult.usage?.totalTokens || 500) * 0.7);
    }
  }

  // Generate handout v2
  if (jenisOutput.includes("handout")) {
    const { systemInstruction, userPrompt } = buildHandoutPromptV2(modulData as any, {
      versi: handoutVersi || "guru",
    });

    const handoutResult = await generateAIContent<HandoutOutputV2>(
      userPrompt,
      { judul: "", ringkasanMateri: "", poinPenting: [], contohSoalLatihan: [], referensiTambahan: null },
      { temperature: 0.4, maxOutputTokens: 6144 }
    );

    if (handoutResult.success && handoutResult.data) {
      result.handoutV2 = handoutResult.data;
      result.tokenUsed += handoutResult.usage?.totalTokens || 800;
      result.usage.inputTokens += Math.ceil((handoutResult.usage?.totalTokens || 800) * 0.3);
      result.usage.outputTokens += Math.ceil((handoutResult.usage?.totalTokens || 800) * 0.7);
    }
  }

  result.usage.totalTokens = result.tokenUsed;

  return result;
}

/**
 * Validate v2 slide output - reject if any slide has more than 5 points
 */
export function validateSlideOutputV2(output: SlideOutputV2): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check minimum slides
  if (output.slides.length < 3) {
    errors.push(`Minimal 3 slide, ditemukan ${output.slides.length} slide`);
  }

  // Check max points per slide
  output.slides.forEach((slide, index) => {
    if (slide.kontenPoin.length > 5) {
      errors.push(`Slide ${slide.nomor || index + 1}: lebih dari 5 poin (${slide.kontenPoin.length})`);
    }
  });

  // Check required slide types are present
  const slideTypes = output.slides.map((s) => s.jenisSlide);
  const requiredTypes = ["pembuka", "tujuan_pembelajaran", "penutup"] as const;
  for (const type of requiredTypes) {
    if (!slideTypes.includes(type)) {
      errors.push(`Slide wajib "${type}" tidak ditemukan`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
