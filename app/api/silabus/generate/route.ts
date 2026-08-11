import { generateAIContentWithUsage } from '@/lib/ai';
import { query } from '@/lib/db';
import { getUserPoinAccess, logFailedPoinUsage } from '@/src/services/poin-service';
import { deductPoinFromAIResult } from '@/src/lib/ai-usage';
import { enforceMarkdownLimits } from '@/lib/ai/limits';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/r2';
import { generateSilabusPdfBuffer, generateSilabusDocBuffer } from '@/lib/export/silabus-export';
import {
  buildSilabusPrompt,
  parseSilabusFromAIResponse,
  SILABUS_SYSTEM_PROMPT,
} from '@/lib/ai/silabusPrompts';
import { silabusFormInputSchema } from '@/lib/schemas/silabus';
import { jsonrepair } from 'jsonrepair';

// ============================================
// SILABUS (ATP) GENERATE API - JSON Structured Output
// Alur Tujuan Pembelajaran dengan AI - Output Terstruktur
// ============================================

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate input
    const validationResult = silabusFormInputSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const {
      mataPelajaran,
      subject_id,
      fase,
      kelas,
      semester,
      kurikulum = 'merdeka',
      dimensi8 = [],
      tiga_pengalaman = false,
      capaianPembelajaran,
      jumlahMingguEfektif = 18,
      tahunAjaran,
      school_id,
      school_name,
      school_npsn,
      jenjang = 'SMA',
      pai_mode,
    } = validationResult.data;

    // Auth
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    // Poin check
    const poinState = await getUserPoinAccess(userId);
    if (!poinState.user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    if (!poinState.access.allowed) {
      const message =
        poinState.access.reason === 'subscription_expired'
          ? 'Masa aktif langganan akun Anda telah habis. Silakan perpanjang paket terlebih dahulu.'
          : 'Poin GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan.';
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const currentUser = poinState.user;

    // Resolve mapel name
    let resolvedMapel = mataPelajaran;
    if (!resolvedMapel && subject_id) {
      try {
        const subjectRes = await query('SELECT nama_mapel FROM subjects WHERE id = $1', [
          subject_id,
        ]);
        if (subjectRes.rows[0]?.nama_mapel) {
          resolvedMapel = subjectRes.rows[0].nama_mapel;
        }
      } catch (subjectErr) {
        console.error('Failed to resolve subject name:', subjectErr);
      }
    }

    if (!resolvedMapel) {
      return NextResponse.json({ error: 'Mata pelajaran wajib diisi' }, { status: 400 });
    }

    // Auto-retrieve CP from structured DB if not provided
    let resolvedCP = capaianPembelajaran;
    if (!resolvedCP) {
      try {
        const { determineJalur, getCPCached, formatCPForPrompt } = await import('@/lib/cp-retrieval');
        const jalur = determineJalur({ jenjang, paiMode: pai_mode, kurikulum });
        const cpRecord = await getCPCached({
          mapel: resolvedMapel,
          jenjang,
          fase,
          jalur,
          tipePendidikan: jalur === 'kneelmenag' ? 'madrasah' : 'reguler',
        });
        if (cpRecord) {
          resolvedCP = formatCPForPrompt(cpRecord);
        }
      } catch (cpErr) {
        // CP retrieval is best-effort — continue without it
        console.warn('[Silabus] CP auto-retrieval failed:', cpErr);
      }
    }

    // Build prompt
    const prompt = buildSilabusPrompt({
      sekolah: school_name,
      npsn: school_npsn,
      tahunAjaran,
      mataPelajaran: resolvedMapel,
      jenjang,
      fase,
      kelas,
      semester: semester as 1 | 2,
      capaianPembelajaran: resolvedCP,
      jumlahMingguEfektif,
      kurikulum,
      dimensi8,
      tigaPengalaman: tiga_pengalaman,
      paiMode: pai_mode,
    });

    // Generate with AI
    let silabusData;
    let aiResult: Awaited<ReturnType<typeof generateAIContentWithUsage>> | null = null;
    try {
      aiResult = await generateAIContentWithUsage(prompt, SILABUS_SYSTEM_PROMPT, true);

      silabusData = parseSilabusFromAIResponse(enforceMarkdownLimits(aiResult.text));
    } catch (aiError: any) {
      console.error('Silabus AI generation failed:', aiError);

      // Log failed usage
      await logFailedPoinUsage(userId, 0, 'generate-silabus', aiError.message);

      // Try repair with jsonrepair
      try {
        const repaired = jsonrepair(aiError.message || String(aiError));
        silabusData = JSON.parse(repaired);
        silabusData = parseSilabusFromAIResponse(silabusData);
      } catch (repairError) {
        return NextResponse.json(
          { error: `Gagal generate Silabus: ${aiError.message}` },
          { status: 502 }
        );
      }
    }

    // Compile & Upload files
    let pdfUrl: string | null = null;
    let docxUrl: string | null = null;

    try {
      const pdfBuf = await generateSilabusPdfBuffer(silabusData);
      pdfUrl = await uploadToR2(pdfBuf, `${Date.now()}-silabus.pdf`, 'application/pdf');

      const docBuf = await generateSilabusDocBuffer(silabusData);
      docxUrl = await uploadToR2(docBuf, `${Date.now()}-silabus.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } catch (uploadErr) {
      console.error('Failed to compile/upload Silabus files:', uploadErr);
    }

    // Save to database
    const docTitle = `Silabus - ${resolvedMapel} ${jenjang} Fase ${fase} Semester ${semester === 1 ? 'Ganjil' : 'Genap'}`;
    let savedId: string | null = null;

    try {
      const result = await query(
        `
        INSERT INTO guru_administrasi (
          user_id, tipe_dokumen, judul_dokumen, konten,
          school_id, subject_id, jenjang, kurikulum, fase, semester,
          dimensi8, tahunAjaran
        ) VALUES ($1, 'silabus', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
        [
          userId,
          docTitle,
          JSON.stringify({
            identitas: silabusData.identitas,
            capaianPembelajaran: silabusData.capaianPembelajaran,
            alurTujuanPembelajaran: silabusData.alurTujuanPembelajaran,
            totalEstimasi: silabusData.totalEstimasi,
            generated_with_ai: true,
            aiGeneratedFields: {},
            pdf_url: pdfUrl,
            docx_url: docxUrl,
          }),
          school_id || null,
          subject_id || null,
          jenjang,
          kurikulum,
          fase,
          semester,
          dimensi8,
          tahunAjaran || null,
        ]
      );
      savedId = result.rows[0]?.id;
    } catch (dbErr) {
      console.error('Failed to save Silabus:', dbErr);
    }

    // Deduct Poin only if AI was used and succeeded (skip for admins)
    if (currentUser.role !== 'admin' && aiResult?.usage) {
      try {
        await deductPoinFromAIResult({ success: true, usage: aiResult.usage }, userId, 'generate-silabus', {});
        console.log(`[Generate Silabus] Poin deducted`);
      } catch (poinError: any) {
        console.error('[Silabus] Poin deduction failed:', poinError);
      }
    }

    return NextResponse.json({
      success: true,
      id: savedId,
      data: silabusData,
      files: {
        pdf_url: pdfUrl,
        docx_url: docxUrl,
      },
    });
  } catch (error: any) {
    console.error('Silabus Generate Error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal generate Silabus' },
      { status: 500 }
    );
  }
}
