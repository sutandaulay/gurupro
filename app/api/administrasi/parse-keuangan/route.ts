import { generateAIContentWithUsage } from '@/lib/ai';
import { jsonrepair as repair } from 'jsonrepair';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUserPoinAccess, logFailedPoinUsage } from '@/src/services/poin-service';
import { deductPoinFromAIResult } from '@/src/lib/ai-usage';
import { getParseKeuanganPrompt } from '@/lib/ai/parseKeuanganPrompts';
import { ParseKeuanganOutputSchema, type ParseKeuanganOutput } from '@/lib/schemas/parse-keuangan';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif.' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const poinAccess = await getUserPoinAccess(userId);
    if (!poinAccess.access.allowed) {
      return NextResponse.json({
        error: poinAccess.access.reason === 'subscription_expired'
          ? 'Masa aktif langganan akun Anda telah habis!'
          : 'Poin GuruPRO Anda telah habis! Silakan isi ulang.',
        reason: poinAccess.access.reason,
        remainingPoin: 0,
      }, { status: 403 });
    }

    const body = await req.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Teks transaksi wajib diisi.' }, { status: 400 });
    }

    const sanitize = (val: string): string => {
      let clean = val.replace(/<[^>]*>/g, '');
      const blocked = [
        /ignore\s+all\s+previous/i,
        /ignore\s+previous/i,
        /system\s+prompt/i,
        /you\s+are\s+now\s+a/i,
        /abaikan\s+instruksi/i,
        /abaikan\s+semua\s+petunjuk/i,
      ];
      for (const p of blocked) {
        clean = clean.replace(p, '[injected-instruction-blocked]');
      }
      return clean.trim();
    };

    const sanitizedText = sanitize(text);

    const jakartaDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const systemPrompt = getParseKeuanganPrompt(jakartaDate);
    const prompt = `Ekstrak transaksi keuangan dari teks berikut:\n\n"${sanitizedText}"\n\nKeluarkan HANYA JSON valid sesuai schema yang sudah diberikan.`;

    const aiResult = await generateAIContentWithUsage(prompt, systemPrompt, true);

    if (!aiResult.text) {
      await logFailedPoinUsage(userId, 0, 'parse-keuangan', 'AI mengembalikan respons kosong');
      return NextResponse.json({ error: 'Gagal memproses teks dengan AI.' }, { status: 500 });
    }

    let rawJson = aiResult.text.trim();
    if (rawJson.startsWith('```')) {
      rawJson = rawJson.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: ParseKeuanganOutput;
    try {
      const repaired = repair(rawJson);
      parsed = ParseKeuanganOutputSchema.parse(JSON.parse(repaired));
    } catch (err: any) {
      console.error('[parse-keuangan] Schema validation error:', err, rawJson);
      await logFailedPoinUsage(userId, 0, 'parse-keuangan', 'Validasi schema gagal: ' + err.message);
      return NextResponse.json({ error: 'AI menghasilkan format yang tidak valid. Coba perjelas teks transaksi Anda.' }, { status: 422 });
    }

    try {
      await deductPoinFromAIResult(
        { success: true, usage: aiResult.usage },
        userId,
        'parse-keuangan',
        {}
      );
    } catch (poinErr: any) {
      console.error('[parse-keuangan] Poin deduction failed:', poinErr);
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('parse-keuangan API error:', error);
    return NextResponse.json({ error: error.message || 'Gagal memproses permintaan.' }, { status: 500 });
  }
}
