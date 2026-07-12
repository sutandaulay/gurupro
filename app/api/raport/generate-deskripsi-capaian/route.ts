import { z } from 'zod';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserTokenAccess, consumeUserToken } from '@/lib/token-system';
import { cookies } from 'next/headers';

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
 */
export const SYSTEM_PROMPT_DESKRIPSI_CAPAIAN = `Kamu adalah asisten AI yang membantu guru menulis deskripsi capaian kompetensi siswa untuk rapor di Indonesia.

Aturan penulisan:
- Bahasa Indonesia formal, positif, spesifik, dan membangun
- JANGAN membuat klaim capaian yang tidak didukung data yang diberikan
- JANGAN memberi label/diagnosis di luar konteks akademik
- Panjang 2-4 kalimat
- Gunakan "Ananda" untuk menyebut siswa
- Output langsung teks deskripsi tanpa prefix atau markup`;

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
): Promise<string> {
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

  return result.response.text();
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

  let promptText = `## Data Masuk:
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
## Aturan Penulisan (Mode Naratif/PAUD):
- Fokus pada PROSES dan OBSERVASI perkembangan anak, bukan skor
- Gunakan bahasa yang menggambarkan perkembangan, minat, dan partisipasi anak
- 2-4 kalimat
- Positif, suportif, dan membangun
- Contoh observasi PAUD: "Ananda menunjukkan antusiasme saat mengikuti kegiatan mewarnai. Ananda mulai mampu mengenali warna-warna dasar dan menuangkan ide melalui gambar."`;
  } else {
    promptText += `
## Aturan Penulisan (Mode Akademik):
- Bahasa Indonesia formal, positif, spesifik
- JANGAN membuat klaim capaian yang tidak didukung data yang diberikan
- JANGAN memberi label/diagnosis di luar konteks akademik
- Panjang 2-4 kalimat
- Langsung tulis deskripsi tanpa prefix`;
  }

  promptText += `

## Output:
Tulis deskripsi capaian dalam 2-4 kalimat. Langsung teks deskripsi tanpa prefix.`;

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

    const tokenState = await getUserTokenAccess(userId);
    if (!tokenState.user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }
    const user = tokenState.user;

    if (!tokenState.access.allowed) {
      const message = tokenState.access.reason === 'subscription_expired'
        ? 'Masa aktif langganan akun Anda telah habis. Silakan perpanjang paket terlebih dahulu.'
        : 'Kredit token GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan.';
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const isGuru = await validateGuruRole(params.guruMapelMemberId);
    if (!isGuru) {
      return NextResponse.json({
        error: 'guruMapelMemberId bukan role guru di institution-members',
      }, { status: 403 });
    }

    const prompt = buildPrompt(params);

    let deskripsi: string;
    try {
      deskripsi = await generateAIDeskripsi(prompt, params.modeNaratif);
    } catch (aiError: any) {
      console.error('AI generation failed:', aiError);
      return NextResponse.json({
        error: `Gagal memproses AI: ${aiError.message || aiError}`,
      }, { status: 502 });
    }

    if (user.role !== 'admin') {
      await consumeUserToken(userId, 1);
    }

    return NextResponse.json({
      success: true,
      deskripsi: deskripsi.trim(),
      sumberAi: true,
    });

  } catch (error: any) {
    console.error('Generate deskripsi capaian error:', error);
    return NextResponse.json({
      error: error.message || 'Internal Server Error',
    }, { status: 500 });
  }
}
