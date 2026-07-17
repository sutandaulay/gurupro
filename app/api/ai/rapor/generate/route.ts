import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { generateRaportDescription, estimateCost } from '@/lib/ai/generators';
import { getUserPoinAccess, consumeUserPoin, logFailedPoinUsage } from '@/src/services/poin-service';
import { calculatePoinFromTokens } from '@/src/lib/ai-usage';

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
 * POST /api/ai/rapor/generate
 * Generate raport description with AI
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
      student_id,
      subject_id,
      assessment_id,
      nilai,
      semester = '1',
      tahun_ajaran,
      kurikulum = 'merdeka',
      save = true,
    } = body;

    const kurikulumLabel: Record<string, string> = {
      merdeka: 'Kurikulum Merdeka',
      k13: 'Kurikulum 2013 (K13)',
      kbc: 'Kurikulum Berbasis Cinta (KBC)',
      hybrid: 'Kurikulum Hybrid (Gabungan)',
    };

    // Validate required fields
    if (!student_id || !subject_id || nilai === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, subject_id, nilai' },
        { status: 400 }
      );
    }

    // Get student info
    const student = await prisma.students.findUnique({
      where: { id: student_id },
      include: { classes: true },
    });

    // Get subject info
    const subject = await prisma.subjects.findUnique({
      where: { id: subject_id },
    });

    // Get assessment for KKM
    let kkm = 75;
    if (assessment_id) {
      const assessment = await prisma.assessments.findUnique({
        where: { id: assessment_id },
      });
      if (assessment) {
        kkm = assessment.kkm;
      }
    }

    // Get previous grade if exists
    let nilaiSebelumnya: number | undefined;
    const previousGrade = await prisma.student_grades.findFirst({
      where: {
        student_id,
        assessments: {
          subject_id,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      include: {
        assessments: true,
      },
    });

    if (previousGrade) {
      nilaiSebelumnya = Number(previousGrade.nilai_akhir);
    }

    // Generate raport description
    const result = await generateRaportDescription({
      nama_siswa: student?.nama_siswa || 'N/A',
      mapel: subject?.nama_mapel || '',
      nilai: Number(nilai),
      kkm,
      jenjang: 'SMA',
      semester,
      tahun_ajaran: tahun_ajaran || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
      nilai_sebelumnya: nilaiSebelumnya,
      kurikulum,
      kurikulumLabel: kurikulumLabel[kurikulum] || 'Kurikulum Merdeka',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to generate raport', details: result.error },
        { status: 500 }
      );
    }

    // Calculate estimated cost
    const cost = result.usage ? estimateCost(result.usage) : { totalCost: 0 };

    // Save to cache if requested
    if (save) {
      const raportCache = await prisma.raport_cache.upsert({
        where: {
          student_id_subject_id_assessment_id: {
            student_id,
            subject_id,
            assessment_id: assessment_id || 'no-assessment',
          },
        },
        update: {
          nilai: Number(nilai),
          ai_description: `${result.data?.deskripsi || ''}${result.data?.saran ? '\n\nSaran: ' + result.data.saran : ''}`,
          generated_at: new Date(),
        },
        create: {
          student_id,
          subject_id,
          assessment_id: assessment_id || null,
          nilai: Number(nilai),
          ai_description: `${result.data?.deskripsi || ''}${result.data?.saran ? '\n\nSaran: ' + result.data.saran : ''}`,
        },
      });

      // Consume Poin after successful generation (non-admin)
      if (userDb?.role !== 'admin') {
        try {
          const rawUsage = result.rawUsage;
          const poinCalc = calculatePoinFromTokens(
            rawUsage?.promptTokenCount || 0,
            rawUsage?.candidatesTokenCount || 0,
            rawUsage?.cachedContentTokenCount || 0
          );

          await consumeUserPoin(userId, poinCalc.rawTokens, 'ai-rapor-generate', {
            model: 'gemini-2.5-flash-lite',
            provider: 'gemini',
          });

          console.log(`[AI Rapor] Poin deducted: ${poinCalc.poinNeeded} (${poinCalc.rawTokens} raw tokens)`);
        } catch (poinErr) {
          console.error('[AI Rapor] Poin deduction failed:', poinErr);
        }
      }

      return NextResponse.json({
        success: true,
        raport: raportCache,
        generated: result.data,
        cost,
      });
    }

    // Consume Poin after successful generation (non-admin, save=false)
    if (userDb?.role !== 'admin') {
      try {
        const rawUsage = result.rawUsage;
        const poinCalc = calculatePoinFromTokens(
          rawUsage?.promptTokenCount || 0,
          rawUsage?.candidatesTokenCount || 0,
          rawUsage?.cachedContentTokenCount || 0
        );

        await consumeUserPoin(userId, poinCalc.rawTokens, 'ai-rapor-generate', {
          model: 'gemini-2.5-flash-lite',
          provider: 'gemini',
        });
      } catch (poinErr) {
        console.error('[AI Rapor] Poin deduction failed:', poinErr);
      }
    }

    return NextResponse.json({
      success: true,
      generated: result.data,
      cost,
    });
  } catch (error: any) {
    console.error('Error generating raport:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai/rapor/generate
 * Generate raport descriptions for multiple students
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { students, subject_id, assessment_id, semester, tahun_ajaran } = body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid students array' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];
    let totalCost = 0;

    // Process in batch
    for (const student of students) {
      try {
        const subResponse = await fetch(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: student.student_id,
            subject_id,
            assessment_id,
            nilai: student.nilai,
            semester,
            tahun_ajaran,
            save: true,
          }),
        });

        const subResult = await subResponse.json();

        if (subResult.success) {
          results.push({
            student_id: student.student_id,
            success: true,
            raport: subResult.raport,
          });
          totalCost += subResult.cost?.totalCost || 0;
        } else {
          errors.push({
            student_id: student.student_id,
            error: subResult.error,
          });
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err: any) {
        errors.push({
          student_id: student.student_id,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total_processed: results.length,
      total_errors: errors.length,
      total_cost: totalCost,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error generating batch raport:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}