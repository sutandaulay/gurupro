/**
 * GuruPRO AI Generator Utilities
 * Fungsi-fungsi untuk generate konten AI
 *
 * Updated: 14 Juli 2026 - Truncation and fallback logic
 * Reference: docs/ai-generation-standard.md
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { truncateText } from './validation-utils';

// Initialize Gemini AI
const googleAIKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
const genAI = googleAIKey ? new GoogleGenerativeAI(googleAIKey) : null;

// Get Gemini model
function getModel(apiVersion?: string) {
  if (!genAI) {
    throw new Error('Google AI API key not configured');
  }
  return genAI.getGenerativeModel(
    {
      model: 'gemini-2.5-flash',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    },
    apiVersion ? { apiVersion } : undefined,
  );
}

export interface GenerationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Generate AI content with structured output
 */
export async function generateAIContent<T>(
  prompt: string,
  fallback: T,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<GenerationResult<T>> {
  try {
    const model = getModel('v1');

    const generationConfig = {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 2048,
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    const text = response.text();

    // Get usage metadata
    const usage = {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
    };

    // Parse JSON response
    let data: T;
    try {
      // Clean markdown code blocks
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.slice(7);
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.slice(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.slice(0, -3);
      }
      data = JSON.parse(cleanText.trim());
    } catch {
      // If not JSON, return as text
      data = text as unknown as T;
    }

    return {
      success: true,
      data,
      usage,
    };
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to generate content',
    };
  }
}

/**
 * Enforce Journal output limits - truncate sesuai batas karakter
 */
function enforceJournalLimits(data: any): GenerationResult<{
  materi_pembelajaran: string;
  tujuan_pembelajaran: string[];
  aktivitas_pembelajaran: string;
  media_pembelajaran: string;
  asesmen_pembelajaran: string;
  refleksi_guru: string;
  tindak_lanjut: string;
}> {
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      error: 'Invalid journal data',
      data: {
        materi_pembelajaran: 'Data tidak tersedia',
        tujuan_pembelajaran: [],
        aktivitas_pembelajaran: 'Data tidak tersedia',
        media_pembelajaran: '-',
        asesmen_pembelajaran: 'Data tidak tersedia',
        refleksi_guru: 'Data tidak tersedia',
        tindak_lanjut: 'Tidak ada tindak lanjut',
      }
    };
  }

  const result = {
    materi_pembelajaran: truncateText(data.materi_pembelajaran, 255) || 'Data tidak tersedia',
    tujuan_pembelajaran: Array.isArray(data.tujuan_pembelajaran)
      ? data.tujuan_pembelajaran.map((tp: string) => truncateText(tp, 150)).slice(0, 5)
      : [],
    aktivitas_pembelajaran: truncateText(data.aktivitas_pembelajaran, 500) || 'Data tidak tersedia',
    media_pembelajaran: truncateText(data.media_pembelajaran, 200) || '-',
    asesmen_pembelajaran: truncateText(data.asesmen_pembelajaran, 300) || 'Data tidak tersedia',
    refleksi_guru: truncateText(data.refleksi_guru, 400) || 'Data tidak tersedia',
    tindak_lanjut: truncateText(data.tindak_lanjut, 300) || 'Tidak ada tindak lanjut',
  };

  return { success: true, data: result };
}

/**
 * Enforce Reflection output limits - truncate sesuai batas karakter
 */
function enforceReflectionLimits(data: any): GenerationResult<{
  berjalan_baik: string;
  hambatan: string;
  solusi: string;
  improvement: string;
}> {
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      error: 'Invalid reflection data',
      data: {
        berjalan_baik: 'Data tidak tersedia',
        hambatan: 'Data tidak tersedia',
        solusi: 'Data tidak tersedia',
        improvement: 'Data tidak tersedia',
      }
    };
  }

  const result = {
    berjalan_baik: truncateText(data.berjalan_baik, 300) || 'Data tidak tersedia',
    hambatan: truncateText(data.hambatan, 300) || 'Data tidak tersedia',
    solusi: truncateText(data.solusi, 300) || 'Data tidak tersedia',
    improvement: truncateText(data.improvement, 300) || 'Data tidak tersedia',
  };

  return { success: true, data: result };
}

/**
 * Generate Journal with AI
 */
export async function generateJournal(params: {
  nama_guru: string;
  mapel: string;
  kelas: string;
  tanggal: string;
  materi?: string;
  jumlah_siswa_hadir: number;
  jumlah_siswa_tidak_hadir: number;
  catatan_guru?: string;
  jenjang: string;
}): Promise<GenerationResult<{
  materi_pembelajaran: string;
  tujuan_pembelajaran: string[];
  aktivitas_pembelajaran: string;
  media_pembelajaran: string;
  asesmen_pembelajaran: string;
  refleksi_guru: string;
  tindak_lanjut: string;
}>> {
  const { generateJournalPrompt } = await import('./prompts');

  const prompt = generateJournalPrompt({
    nama_guru: params.nama_guru,
    mapel: params.mapel,
    kelas: params.kelas,
    tanggal: params.tanggal,
    materi: params.materi,
    jumlah_siswa_hadir: params.jumlah_siswa_hadir,
    jumlah_siswa_tidak_hadir: params.jumlah_siswa_tidak_hadir,
    catatan_guru: params.catatan_guru,
    jenjang: params.jenjang,
  });

  const result = await generateAIContent(prompt, {
    materi_pembelajaran: '',
    tujuan_pembelajaran: [],
    aktivitas_pembelajaran: '',
    media_pembelajaran: '',
    asesmen_pembelajaran: '',
    refleksi_guru: '',
    tindak_lanjut: '',
  });

  if (!result.success || !result.data) {
    return result;
  }

  // Enforce limits after generation
  const data = result.data as any;
  return enforceJournalLimits(data);
}

/**
 * Generate Reflection with AI
 */
export async function generateReflection(params: {
  nama_guru: string;
  mapel: string;
  kelas: string;
  materi: string;
  aktivitas: string;
  jumlah_hadir: number;
  jumlah_tidak_hadir: number;
  catatan?: string;
}): Promise<GenerationResult<{
  berjalan_baik: string;
  hambatan: string;
  solusi: string;
  improvement: string;
}>> {
  const { generateReflectionPrompt } = await import('./prompts');

  const prompt = generateReflectionPrompt({
    nama_guru: params.nama_guru,
    mapel: params.mapel,
    kelas: params.kelas,
    materi: params.materi,
    aktivitas: params.aktivitas,
    jumlah_hadir: params.jumlah_hadir,
    jumlah_tidak_hadir: params.jumlah_tidak_hadir,
    catatan: params.catatan,
  });

  const result = await generateAIContent(prompt, {
    berjalan_baik: '',
    hambatan: '',
    solusi: '',
    improvement: '',
  });

  if (!result.success || !result.data) {
    return result;
  }

  // Enforce limits after generation
  const data = result.data as any;
  return enforceReflectionLimits(data);
}

/**
 * Generate Raport Description with AI
 */
export async function generateRaportDescription(params: {
  nama_siswa: string;
  mapel: string;
  nilai: number;
  kkm: number;
  jenjang: string;
  semester: string;
  tahun_ajaran: string;
  nilai_sebelumnya?: number;
  kurikulum?: string;
  kurikulumLabel?: string;
}): Promise<GenerationResult<{
  deskripsi: string;
  saran: string;
}>> {
  const { generateRaportPrompt } = await import('./prompts');

  const prompt = generateRaportPrompt({
    nama_siswa: params.nama_siswa,
    mapel: params.mapel,
    nilai: params.nilai,
    kkm: params.kkm,
    jenjang: params.jenjang,
    semester: params.semester,
    tahun_ajaran: params.tahun_ajaran,
    nilai_sebelumnya: params.nilai_sebelumnya,
    kurikulum: params.kurikulum,
    kurikulumLabel: params.kurikulumLabel,
  });

  return generateAIContent(prompt, {
    deskripsi: '',
    saran: '',
  });
}

/**
 * Generate WhatsApp Message for Absent Alert
 */
export async function generateAbsentAlertMessage(params: {
  nama_siswa: string;
  kelas: string;
  nama_guru: string;
  nama_sekolah: string;
  jumlah_tidak_hadir: number;
  periode: string;
}): Promise<GenerationResult<{
  subject: string;
  message: string;
  tone: string;
  urgency: string;
}>> {
  const { generateAbsentAlertPrompt } = await import('./prompts');

  const prompt = generateAbsentAlertPrompt({
    nama_siswa: params.nama_siswa,
    kelas: params.kelas,
    nama_guru: params.nama_guru,
    nama_sekolah: params.nama_sekolah,
    jumlah_tidak_hadir: params.jumlah_tidak_hadir,
    periode: params.periode,
  });

  return generateAIContent(prompt, {
    subject: '',
    message: '',
    tone: 'formal',
    urgency: 'medium',
  });
}

/**
 * Generate Class Analytics
 */
export async function generateClassAnalytics(params: {
  kelas: string;
  mapel: string;
  jenjang: string;
  jumlah_siswa: number;
  rata_rata_nilai: number;
  kkm: number;
  siswa_belum_tuntas: { nama: string; nilai: number }[];
  siswa_tuntas: number;
  persentase_hadir: number;
  trend_nilai: 'meningkat' | 'menurun' | 'stabil';
}): Promise<GenerationResult<any>> {
  const { generateAnalyticsPrompt } = await import('./prompts');

  const prompt = generateAnalyticsPrompt(params);

  return generateAIContent(prompt, {
    summary: '',
    kekuatan_kelas: [],
    area_perbaikan: [],
    rekomendasi: [],
    siswa_prioritas_remedial: [],
  });
}

/**
 * Generate Chat Response
 */
export async function generateChatResponse(params: {
  userMessage: string;
  context: {
    nama_guru: string;
    mapel?: string;
    kelas?: string;
    jenjang?: string;
    hari_ini_tanggal: string;
    tugas_pending?: string[];
  };
  chatHistory?: { role: string; content: string }[];
}): Promise<GenerationResult<{
  response: string;
  action?: {
    type: string;
    data: any;
  };
  suggestions?: string[];
}>> {
  const { generateChatSystemPrompt } = await import('./prompts');

  const systemPrompt = generateChatSystemPrompt({
    nama_guru: params.context.nama_guru,
    mapel: params.context.mapel,
    kelas: params.context.kelas,
    jenjang: params.context.jenjang,
    hari_ini_tanggal: params.context.hari_ini_tanggal,
    tugas_pending: params.context.tugas_pending,
  });

  // Build conversation
  const conversationHistory = params.chatHistory
    ?.map(m => `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.content}`)
    .join('\n') || '';

  const fullPrompt = `
${systemPrompt}

## Riwayat Percakapan:
${conversationHistory}

## Pesan Baru dari User:
User: ${params.userMessage}

## Instruksi Tambahan:
1. Jika user meminta membuat sesuatu (jurnal, RPP, soal, dll), tawarkan detail yang perlu dipenuhi
2. Jika kamu bisa langsung membuat konten, langsung buatkan dalam format yang sesuai
3. Selalu tawarkan bantuan lain di akhir respons
4. Respons dalam Bahasa Indonesia formal

## Respons:
`;

  try {
    const model = getModel('v1');

    const generationConfig = {
      temperature: 0.8,
      maxOutputTokens: 2048,
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig,
    });

    const response = result.response;
    const text = response.text();

    const usage = {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
    };

    return {
      success: true,
      data: {
        response: text,
        suggestions: [],
      },
      usage,
    };
  } catch (error: any) {
    console.error('AI Chat Generation Error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to generate chat response',
    };
  }
}

/**
 * Estimate generation cost in IDR
 */
export function estimateCost(usage?: { inputTokens: number; outputTokens: number }): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
} {
  // Gemini 1.5 Flash pricing (per 1M tokens)
  const INPUT_PRICE_PER_M = 0.035; // USD
  const OUTPUT_PRICE_PER_M = 0.05; // USD
  const USD_TO_IDR = 16500; // Exchange rate

  const inputCost = usage
    ? (usage.inputTokens / 1_000_000) * INPUT_PRICE_PER_M * USD_TO_IDR
    : 0;

  const outputCost = usage
    ? (usage.outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M * USD_TO_IDR
    : 0;

  return {
    inputCost: Math.round(inputCost),
    outputCost: Math.round(outputCost),
    totalCost: Math.round(inputCost + outputCost),
  };
}