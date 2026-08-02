import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { generateJournal, estimateCost } from '@/lib/ai/generators';
import { getUserPoinAccess, logFailedPoinUsage } from '@/src/services/poin-service';
import { deductPoinFromAIResult } from '@/src/lib/ai-usage';

const prisma = new PrismaClient();

/**
 * Helper to get current user from session cookie
 */
async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session');

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    return sessionData;
  } catch {
    return null;
  }
}

/**
 * POST /api/ai/journal/generate
 * Generate journal with AI
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Token check (non-admin)
    const userDb = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (userDb?.role !== 'admin') {
      const poinAccess = await getUserPoinAccess(userId);
      if (!poinAccess.access.allowed) {
        return NextResponse.json({
          error: poinAccess.access.reason === 'subscription_expired'
            ? 'Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu.'
            : 'Poin GuruPRO Anda telah habis! Silakan lakukan isi ulang atau upgrade langganan di Landing Page.',
          reason: poinAccess.access.reason,
          remainingPoin: 0,
        }, { status: 403 });
      }
    }

    const body = await request.json();

    const {
      schedule_id,
      class_id,
      subject_id,
      school_id,
      materi,
      jumlah_siswa_hadir = 0,
      jumlah_siswa_tidak_hadir = 0,
      catatan_guru,
      save = true,
    } = body;

    // Validate required fields
    if (!class_id || !subject_id || !school_id) {
      return NextResponse.json(
        { error: 'Missing required fields: class_id, subject_id, school_id' },
        { status: 400 }
      );
    }

    // Get user info
    const userData = await prisma.users.findUnique({
      where: { id: userId },
      select: { nama_lengkap: true },
    });

    // Get class and subject info
    const [classInfo, subjectInfo] = await Promise.all([
      prisma.classes.findUnique({ where: { id: class_id } }),
      prisma.subjects.findUnique({ where: { id: subject_id } }),
    ]);

    const today = new Date();
    const formattedDate = today.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Generate journal with AI
    const result = await generateJournal({
      nama_guru: userData?.nama_lengkap || 'Guru',
      mapel: subjectInfo?.nama_mapel || '',
      kelas: classInfo?.nama_kelas || '',
      tanggal: formattedDate,
      materi,
      jumlah_siswa_hadir,
      jumlah_siswa_tidak_hadir,
      catatan_guru,
      jenjang: 'SMA',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to generate journal', details: result.error },
        { status: 500 }
      );
    }

    // Calculate estimated cost
    const cost = result.usage ? estimateCost(result.usage) : { totalCost: 0 };

    // Save to database if requested
    if (save) {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const journal = await prisma.teacher_journals.create({
        data: {
          user_id: userId,
          school_id: school_id,
          schedule_id: schedule_id || null,
          class_id: class_id,
          subject_id: subject_id,
          tanggal: todayDate,
          materi_pembelajaran: result.data?.materi_pembelajaran || materi || '',
          tujuan_pembelajaran: result.data?.tujuan_pembelajaran?.join('\n') || '',
          aktivitas_pembelajaran: result.data?.aktivitas_pembelajaran || '',
          media_pembelajaran: result.data?.media_pembelajaran || '',
          asesmen_pembelajaran: result.data?.asesmen_pembelajaran || '',
          refleksi_guru: result.data?.refleksi_guru || '',
          tindak_lanjut: result.data?.tindak_lanjut || '',
          status: 'Draft',
          auto_generated: true,
          source_schedule_id: schedule_id || null,
        },
      });

      // Consume Poin after successful generation (non-admin)
      if (userDb?.role !== 'admin') {
        try {
          await deductPoinFromAIResult(
            { success: true, usage: (result.usage as any) || null },
            userId,
            'ai-journal-generate',
            {}
          );

          console.log(`[AI Journal] Poin deducted`);
        } catch (poinErr) {
          console.error('[AI Journal] Poin deduction failed:', poinErr);
        }
      }

      return NextResponse.json({
        success: true,
        journal,
        generated: result.data,
        cost,
      });
    }

    // Consume Poin after successful generation (non-admin, mode save=false)
    if (userDb?.role !== 'admin') {
      try {
        await deductPoinFromAIResult(
          { success: true, usage: (result.usage as any) || null },
          userId,
          'ai-journal-generate',
          {}
        );
      } catch (poinErr) {
        console.error('[AI Journal] Poin deduction failed:', poinErr);
      }
    }

    return NextResponse.json({
      success: true,
      generated: result.data,
      cost,
    });
  } catch (error: any) {
    console.error('Error generating journal:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/journal/generate
 * Get default journal structure/format
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    structure: {
      materi_pembelajaran: 'string (max 255 chars)',
      tujuan_pembelajaran: 'array of strings',
      aktivitas_pembelajaran: 'string (multi-line)',
      media_pembelajaran: 'string',
      asesmen_pembelajaran: 'string',
      refleksi_guru: 'string (multi-line)',
      tindak_lanjut: 'string',
    },
    tips: [
      'Semakin detail input materi, semakin akurat hasil AI',
      'Hasil AI bisa diedit sebelum disimpan',
      'Refleksi akan lebih personal jika ditambah catatan guru',
    ],
  });
}