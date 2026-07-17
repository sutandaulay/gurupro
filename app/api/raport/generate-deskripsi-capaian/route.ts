import { z } from 'zod';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserPoinAccess, consumeUserPoin, logFailedPoinUsage } from '@/src/services/poin-service';
import { calculatePoinFromTokens } from '@/src/lib/ai-usage';
import { cookies } from 'next/headers';
import { truncateText } from '@/lib/ai/validation-utils';

export const GenerateDeskripsiCapaianRequestSchema = z.object({
  siswaId: z.string().uuid(),
  mapelId: z.string().uuid(),
  kelasId: z.string().uuid(),
  guruMapelMemberId: z.string().uuid(),
  kurikulum: z.enum(['kurikulum_merdeka', 'k13', 'kbc', 'hybrid']),
  basisDeskripsi: z.enum(['capaian_pembelajaran', 'alur_tujuan_pembelajaran', 'poin_materi']),
  capaianPembelajaranText: z.string().min(1),
  nilaiAkhir: z.number().min(0).max(100).nullable(),
  catatanTambahanGuru: z.string().optional(),
  modeNaratif: z.boolean().default(false),
});

export type GenerateDeskripsiCapaianRequest = z.infer<typeof GenerateDeskripsiCapaianRequestSchema>;

/**
 * System prompt untuk deskripsi capaian (dapat digunakan dengan cachedContent).
 * Cache key: `${kurikulum}-${mapelId}` — reuse pola context caching existing.
 * Untuk PAUD/modeNaratif, prompt user menyertakan instruksi spesifik naratif.
 *
 * Updated: 14 Juli 2026 - Menambahkan batas karakter, larangan markdown, dan few-shot examples
 * Reference: docs/ai-generation-standard.md
 */
export const SYSTEM_PROMPT_DESKRIPSI_CAPAIAN = `Kamu adalah asisten AI yang membantu guru menulis deskripsi capaian kompetensi siswa untuk rapor di Indonesia.

ATURAN WAJIB:
1. Bahasa Indonesia formal, positif, spesifik, dan membangun
2. JANGAN membuat klaim capaian yang tidak didukung data yang diberikan
3. JANGAN memberi label/diagnosis di luar konteks akademik
4. Gunakan "Ananda [nama_siswa]" di awal kalimat pertama
5. GAYA: Sopan, mendukung, inspiratif

BATASAN PANJANG (WAJIB DIIKUTI):
- deskripsi: MAKSIMAL 500 KARAKTER TOTAL
- saran: MAKSIMAL 200 KARAKTER

OUTPUT JSON SCHEMA:
{
  "deskripsi": "string (maks 500 karakter)",
  "saran": "string (maks 200 karakter, opsional)"
}

CONTOH OUTPUT (NILAI BAIK - KKM 75):
Input: nama=Andi, mapel=Matematika, nilai=88, kkm=75
Output:
{
  "deskripsi": "Ananda Andi menunjukkan kemampuan yang sangat baik dalam memahami operasi hitung pecahan. Siswa mampu menyelesaikan soal aplikasi dengan langkah yang tepat dan mandiri. Apresiasi atas konsistensi dan usahanya dalam belajar matematika.",
  "saran": "Terus berlatih variasi soal untuk memperdalam pemahaman konsep."
}

CONTOH OUTPUT (NILAI KURANG - KKM 75):
Input: nama=Sari, mapel=Bahasa Indonesia, nilai=62, kkm=75
Output:
{
  "deskripsi": "Ananda Sari masih membutuhkan bimbingan tambahan dalam memahami kosakata baru. Dengan latihan membaca rutin dan bertanya saat menemukan kesulitan, kemampuan ini dapat segera ditingkatkan.",
  "saran": "Disarankan membaca buku cerita 15 menit setiap hari dan mencatat kosakata baru."
}

CATATAN: AI TIDAK SELALU PATUH BATASAN KARAKTER. LAKUKAN TRUNCATE DI LAYER VALIDASI.`;

async function validateGuruRole(memberId: string): Promise<boolean> {
  const res = await query(
    `SELECT validate_guru_mapel_member($1) as is_valid`,
    [memberId]
  );
  return res.rows[0]?.is_valid === true;
}

async function generateAIDeskripsi(
  prompt: string,
  modeNaratif: boolean
): Promise<{ deskripsi: string; saran: string; rawUsage?: any }> {
  const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = await import('@google/generative-ai');

  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Google AI API key not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    {
      model: 'gemini-2.5-flash-lite',
      systemInstruction: SYSTEM_PROMPT_DESKRIPSI_CAPAIAN,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    },
    { apiVersion: 'v1' }
  );

  const generationConfig = {
    temperature: 0.7,
    maxOutputTokens: 512,
  };

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  });

  const rawText = result.response.text();

  // Get raw usage metadata
  const rawUsage = {
    promptTokenCount: result.response.usageMetadata?.promptTokenCount || 0,
    candidatesTokenCount: result.response.usageMetadata?.candidatesTokenCount || 0,
    totalTokenCount: result.response.usageMetadata?.totalTokenCount || 0,
    cachedContentTokenCount: result.response.usageMetadata?.cachedContentTokenCount || 0,
  };

  // Parse JSON dengan cleanup dan enforce limits
  let cleanText = rawText.trim()
    .replace(/```json\s*|```\s*/gi, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanText);
    return { ...enforceOutputLimits(parsed), rawUsage };
  } catch {
    // Fallback jika JSON parse gagal - truncate raw text
    console.warn('[Deskripsi Capaian] JSON parse failed, using truncated fallback');
    return {
      deskripsi: truncateText(rawText, 500) || 'Ananda menunjukkan pemahaman terhadap materi pembelajaran.',
      saran: '',
      rawUsage,
    };
  }
}

/**
 * Enforce output limits - truncate sesuai batas karakter
 */
function enforceOutputLimits(output: { deskripsi?: unknown; saran?: unknown }): { deskripsi: string; saran: string } {
  const rawDeskripsi = typeof output.deskripsi === 'string' ? output.deskripsi : '';
  const rawSaran = typeof output.saran === 'string' ? output.saran : '';

  return {
    deskripsi: truncateText(rawDeskripsi, 500) || 'Ananda menunjukkan pemahaman yang baik terhadap materi pembelajaran.',
    saran: truncateText(rawSaran, 200) || ''
  };
}

function buildPrompt(params: GenerateDeskripsiCapaianRequest): string {
  const basisDeskripsiLabel = {
    capaian_pembelajaran: 'Capaian Pembelajaran',
    alur_tujuan_pembelajaran: 'Alur Tujuan Pembelajaran',
    poin_materi: 'Poin Materi',
  }[params.basisDeskripsi];

  const kurikulumLabels: Record<string, string> = {
    kurikulum_merdeka: 'Kurikulum Merdeka',
    k13: 'Kurikulum 2013 (K13)',
    kbc: 'KBC (Kurikulum Berbasis Cinta)',
    hybrid: 'Hybrid (K13 + Merdeka)',
  };
  const kurikulumLabel = kurikulumLabels[params.kurikulum] || params.kurikulum;

  let promptText = `## DATA MASUK:
- Kurikulum: ${kurikulumLabel}
- Basis Deskripsi: ${basisDeskripsiLabel}
- Capaian Pembelajaran: ${params.capaianPembelajaranText}
`;

  if (params.nilaiAkhir !== null && params.nilaiAkhir !== undefined) {
    promptText += `- Nilai Akhir: ${params.nilaiAkhir}\n`;
  }

  if (params.catatanTambahanGuru) {
    promptText += `- Catatan Tambahan Guru: ${params.catatanTambahanGuru}\n`;
  }

  if (params.modeNaratif) {
    promptText += `
## ATURAN PENULISAN (Mode Naratif/PAUD):
- Fokus pada PROSES dan OBSERVASI perkembangan anak, bukan skor
- Gunakan bahasa yang menggambarkan perkembangan, minat, dan partisipasi anak
- 2-4 kalimat
- Positif, suportif, dan membangun
- Contoh observasi PAUD: "Ananda menunjukkan antusiasme saat mengikuti kegiatan mewarnai."`;
  } else {
    promptText += `
## ATURAN PENULISAN (Mode Akademik):
- Bahasa Indonesia formal, positif, spesifik
- JANGAN membuat klaim capaian yang tidak didukung data yang diberikan
- JANGAN memberi label/diagnosis di luar konteks akademik
- Gunakan "Ananda [nama]" di awal kalimat
- Panjang deskripsi: MAKSIMAL 500 KARAKTER
- Panjang saran: MAKSIMAL 200 KARAKTER
- OUTPUT JSON SESUAI SCHEMA DI BAWAH`;
  }

  promptText += `

## OUTPUT JSON SCHEMA:
{
  "deskripsi": "string (maks 500 karakter)",
  "saran": "string (maks 200 karakter, opsional)"
}

## INSTRUKSI:
1. Parse data di atas
2. Tulis deskripsi dalam format JSON sesuai schema
3. JANGAN tambahkan markdown fence atau teks lain
4. Langsung output JSON saja`;

  return promptText;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = GenerateDeskripsiCapaianRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Validasi gagal',
        details: parsed.error.issues,
      }, { status: 400 });
    }

    const params = parsed.data;

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif.' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const poinState = await getUserPoinAccess(userId);
    if (!poinState.user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }
    const user = poinState.user;

    if (!poinState.access.allowed) {
      const message = poinState.access.reason === 'subscription_expired'
        ? 'Masa aktif langganan akun Anda telah habis. Silakan perpanjang paket terlebih dahulu.'
        : 'Poin GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan.';
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const isGuru = await validateGuruRole(params.guruMapelMemberId);
    if (!isGuru) {
      return NextResponse.json({
        error: 'guruMapelMemberId bukan role guru di institution-members',
      }, { status: 403 });
    }

    const prompt = buildPrompt(params);

    let result: { deskripsi: string; saran: string };
    let rawUsage = null;
    try {
      const aiResult = await generateAIDeskripsi(prompt, params.modeNaratif);
      result = aiResult;
      rawUsage = aiResult.rawUsage;
    } catch (aiError: any) {
      console.error('AI generation failed:', aiError);

      // Log failed usage
      await logFailedPoinUsage(userId, 0, 'generate-deskripsi-capaian', aiError.message);

      return NextResponse.json({
        error: `Gagal memproses AI: ${aiError.message || aiError}`,
      }, { status: 502 });
    }

    if (user.role !== 'admin') {
      try {
        const poinCalc = calculatePoinFromTokens(
          rawUsage?.promptTokenCount || 0,
          rawUsage?.candidatesTokenCount || 0,
          rawUsage?.cachedContentTokenCount || 0
        );

        await consumeUserPoin(userId, poinCalc.rawTokens, 'generate-deskripsi-capaian', {
          model: 'gemini-2.5-flash-lite',
          provider: 'gemini',
        });

        console.log(`[Generate Deskripsi Capaian] Poin deducted: ${poinCalc.poinNeeded} (${poinCalc.rawTokens} raw tokens)`);
      } catch (poinError: any) {
        console.error('[Generate Deskripsi Capaian] Poin deduction failed:', poinError);
      }
    }

    return NextResponse.json({
      success: true,
      deskripsi: result.deskripsi.trim(),
      saran: result.saran.trim(),
      sumberAi: true,
    });

  } catch (error: any) {
    console.error('Generate deskripsi capaian error:', error);
    return NextResponse.json({
      error: error.message || 'Internal Server Error',
    }, { status: 500 });
  }
}
