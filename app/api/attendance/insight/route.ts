import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { db, query } from '@/lib/db';
import {
  attendanceSummary,
  institutions as institutionsTable,
} from '@/lib/schemas/attendance';
import { attendanceInsights as attendanceInsightsTable } from '@/lib/schemas/attendance-insight';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { parseISO, startOfWeek, endOfWeek, format, differenceInDays } from 'date-fns';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { createId } from '@paralleldrive/cuid2';
import { deductPoinFromAIResult } from '@/src/lib/ai-usage';
import { getUserPoinAccess } from '@/src/services/poin-service';

// Schema untuk validasi input
const InsightRequestSchema = z.object({
  periodType: z.enum(['weekly', 'monthly']),
  periodStart: z.string(),
  periodEnd: z.string(),
  teacherId: z.string().uuid().optional(), // Hanya untuk admin/kepala sekolah untuk lihat insight guru lain
});

// Schema untuk output dari AI
const InsightResponseSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const validatedData = InsightRequestSchema.parse(body);

    // Jika teacherId tidak disediakan, gunakan ID pengguna saat ini
    const targetTeacherId = validatedData.teacherId || session.id;

    // Validasi akses: hanya admin, kepala sekolah, wakasek, atau operator yang bisa melihat insight guru lain
    if (targetTeacherId !== session.id && !['admin', 'kepala_sekolah', 'wakasek', 'operator'].includes(session.role || '')) {
      return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses untuk melihat insight guru ini' }, { status: 403 });
    }

    // Jika bukan admin dan ingin melihat insight guru lain, pastikan guru tersebut berada di institusi yang sama
    if (targetTeacherId !== session.id && (session.role || '') !== 'admin') {
      const membersResult = await query(`
        SELECT institution_id as "institutionId"
        FROM public.institution_members
        WHERE app_user_id = $1 AND status = 'active'
      `, [session.id]);
      const userInstitutionMembers = membersResult.rows;

      const assignmentsResult = await query(`
        SELECT institution_id as "institutionId"
        FROM public.institution_members
        WHERE app_user_id = $1 AND status = 'active'
      `, [targetTeacherId]);
      const teacherAssignments = assignmentsResult.rows;

      // Pastikan guru yang dituju berada di salah satu institusi tempat pengguna saat ini bertugas
      const hasAccess = teacherAssignments.some(assignment => 
        userInstitutionMembers.some(member => Number(member.institutionId) === assignment.institutionId)
      );

      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses ke data guru ini' }, { status: 403 });
      }
    }

    // Poin check (non-admin) — sebelum generate AI
    const userId = session.id;
    if ((session.role || '') !== 'admin') {
      const poinAccess = await getUserPoinAccess(userId);
      if (!poinAccess.access.allowed) {
        return NextResponse.json({
          error: poinAccess.access.reason === 'subscription_expired'
            ? 'Masa aktif langganan akun Anda telah habis.'
            : 'Poin GuruPRO Anda telah habis! Silakan isi ulang.',
          reason: poinAccess.access.reason,
          remainingPoin: 0,
        }, { status: 403 });
      }
    }

    // Parse tanggal
    const startDate = parseISO(validatedData.periodStart);
    const endDate = parseISO(validatedData.periodEnd);

    // Cek apakah sudah ada insight yang di-cache untuk periode ini
    const [cachedInsight] = await db.select()
      .from(attendanceInsightsTable)
      .where(and(
        eq(attendanceInsightsTable.teacherId, targetTeacherId),
        eq(attendanceInsightsTable.periodType, validatedData.periodType),
        eq(attendanceInsightsTable.periodStart, startDate),
        eq(attendanceInsightsTable.periodEnd, endDate)
      ));

    if (cachedInsight) {
      return NextResponse.json({
        success: true,
        message: 'Insight diambil dari cache',
        insight: cachedInsight,
      });
    }

    // Ambil data kehadiran untuk periode yang diminta
    const attendanceData = await db.select({
      id: attendanceSummary.id,
      teacherId: attendanceSummary.teacherId,
      institutionId: attendanceSummary.institutionId,
      date: attendanceSummary.date,
      attendanceStatus: attendanceSummary.attendanceStatus,
      teachingMinutesTotal: attendanceSummary.teachingMinutesTotal,
      teachingSessionsCompleted: attendanceSummary.teachingSessionsCompleted,
      lateMinutes: attendanceSummary.lateMinutes,
    })
    .from(attendanceSummary)
    .where(and(
      eq(attendanceSummary.teacherId, targetTeacherId),
      gte(attendanceSummary.date, startDate),
      lte(attendanceSummary.date, endDate)
    ));

    // Ambil informasi institusi guru yang bersangkutan
    const assignmentsResult2 = await query(`
      SELECT institution_id as "institutionId"
      FROM public.institution_members
      WHERE app_user_id = $1 AND status = 'active'
    `, [targetTeacherId]);
    const teacherAssignments = assignmentsResult2.rows;

    const fallbackInstitutions = await db.select({ id: institutionsTable.id })
      .from(institutionsTable);

    const institutionId = teacherAssignments[0]?.institutionId
      ?? Number(fallbackInstitutions[0]?.id)
      ?? 0;

    // Hitung statistik
    let totalMinutes = 0;
    let totalSessions = 0;
    let attendanceDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    const minutesByInstitution: Record<string, number> = {};

    attendanceData.forEach(record => {
      totalMinutes += Number(record.teachingMinutesTotal);
      totalSessions += Number(record.teachingSessionsCompleted);
      
      if (record.attendanceStatus === 'hadir' || record.attendanceStatus === 'telat') {
        attendanceDays++;
        if (record.attendanceStatus === 'telat') {
          lateDays++;
        }
      } else if (record.attendanceStatus === 'alpa') {
        absentDays++;
      }

      // Tambahkan ke perhitungan per institusi
      if (!minutesByInstitution[record.institutionId]) {
        minutesByInstitution[record.institutionId] = 0;
      }
      minutesByInstitution[record.institutionId] += Number(record.teachingMinutesTotal);
    });

    // Hitung jumlah hari dalam periode
    const totalDays = differenceInDays(endDate, startDate) + 1;

    // Siapkan data untuk dikirim ke AI
    const inputData = {
      teacherId: targetTeacherId,
      period: {
        type: validatedData.periodType,
        start: validatedData.periodStart,
        end: validatedData.periodEnd,
        totalDays,
      },
      statistics: {
        totalMinutes,
        totalSessions,
        attendanceDays,
        lateDays,
        absentDays,
        minutesByInstitution,
      },
      requiredMinutes: 1440, // 24 jam per minggu
      isRequirementMet: totalMinutes >= 1440,
      deficit: totalMinutes >= 1440 ? 0 : 1440 - totalMinutes,
    };

    // Panggil AI untuk generate insight
    try {
      const { object } = await generateObject({
        model: google('gemini-2.5-flash-lite'),
        schema: InsightResponseSchema,
        prompt: `
          Berikan analisis insight naratif berbahasa Indonesia dalam format JSON untuk seorang guru berdasarkan data kehadiran dan jam mengajar mingguan berikut:
          
          Data:
          - Total jam mengajar: ${inputData.statistics.totalMinutes} menit (${Math.floor(inputData.statistics.totalMinutes / 60)} jam ${(inputData.statistics.totalMinutes % 60)} menit)
          - Target mingguan: 24 jam (1440 menit)
          - Total sesi mengajar: ${inputData.statistics.totalSessions}
          - Hari kehadiran: ${inputData.statistics.attendanceDays}
          - Hari keterlambatan: ${inputData.statistics.lateDays}
          - Hari absen: ${inputData.statistics.absentDays}
          - Distribusi jam per institusi: ${JSON.stringify(inputData.statistics.minutesByInstitution)}
          - Apakah mencapai target: ${inputData.isRequirementMet ? 'Ya' : 'Tidak'}
          - Kekurangan (jika ada): ${inputData.deficit} menit

          Petunjuk:
          - Gunakan nada informatif dan positif, hindari bahasa yang menghakimi
          - Fokus pada fakta dan pola yang terlihat
          - Jika guru mengajar di lebih dari satu institusi, sebutkan kontribusi dari masing-masing institusi
          - Berikan rekomendasi yang konstruktif
          - Untuk kepala sekolah, fokuskan insight hanya pada data dari institusi mereka
        `,
      });

      // Deduct Poin (AI SDK tidak give usage metadata langsung — estimasi)
      if ((session.role || '') !== 'admin') {
        try {
          const estimatedInputTokens = Math.ceil(prompt.length / 4); // ~4 chars/token
          const estimatedOutputTokens = 300; // JSON output khas
          const estimatedTokens = estimatedInputTokens + estimatedOutputTokens;

          await deductPoinFromAIResult(
            {
              success: true,
              usage: {
                inputTokens: estimatedInputTokens,
                outputTokens: estimatedOutputTokens,
                cachedTokens: 0,
                provider: 'gemini',
                model: 'gemini-2.5-flash-lite',
              },
            },
            userId,
            'attendance-insight',
            {}
          );
        } catch (poinErr) {
          console.error('[Attendance Insight] Poin deduction failed:', poinErr);
        }
      }

      // Simpan hasil ke cache
      const [newInsight] = await db.insert(attendanceInsightsTable).values({
        id: createId(),
        teacherId: targetTeacherId,
        institutionId: institutionId, // Gunakan institusi assignment guru (atau fallback institusi pertama)
        periodType: validatedData.periodType,
        periodStart: startDate,
        periodEnd: endDate,
        insightData: object,
        teachingMinutesTotal: totalMinutes,
        teachingSessionsCompleted: totalSessions,
        attendanceDays: attendanceDays,
        lateDays: lateDays,
      }).returning();

      return NextResponse.json({
        success: true,
        message: 'Insight berhasil digenerate',
        insight: newInsight,
      });
    } catch (aiError) {
      console.error('Error generating AI insight:', aiError);
      
      // Jika AI gagal, kembalikan fallback insight
      const fallbackInsight = {
        summary: "Tidak dapat menggenerate insight AI saat ini. Berikut ringkasan data kehadiran Anda.",
        highlights: [
          `Total jam mengajar: ${Math.floor(totalMinutes / 60)} jam ${(totalMinutes % 60)} menit`,
          `Total sesi mengajar: ${totalSessions} sesi`,
          `Hari kehadiran: ${attendanceDays} hari`
        ],
        recommendations: [
          "Pastikan kehadiran tetap konsisten minggu depan",
          "Pertimbangkan untuk meratakan jam mengajar di seluruh institusi"
        ]
      };

      return NextResponse.json({
        success: true,
        message: 'AI insight gagal digenerate, menggunakan fallback',
        insight: {
          id: createId(),
          teacherId: targetTeacherId,
          institutionId: institutionId,
          periodType: validatedData.periodType,
          periodStart: startDate,
          periodEnd: endDate,
          insightData: fallbackInsight,
          teachingMinutesTotal: totalMinutes,
          teachingSessionsCompleted: totalSessions,
          attendanceDays: attendanceDays,
          lateDays: lateDays,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        usingFallback: true,
      });
    }
  } catch (error) {
    console.error('Attendance insight error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validasi input gagal', 
          details: error.issues 
        }, 
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}

// Endpoint GET untuk mengambil insight yang sudah ada
export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const url = new URL(req.url);
    const periodType = url.searchParams.get('periodType') || 'weekly';
    const periodStart = url.searchParams.get('periodStart');
    const periodEnd = url.searchParams.get('periodEnd');
    const teacherId = url.searchParams.get('teacherId');

    // Validasi parameter
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Parameter periodStart dan periodEnd diperlukan' }, { status: 400 });
    }

    // Jika teacherId tidak disediakan, gunakan ID pengguna saat ini
    const targetTeacherId = teacherId || session.id || '';

    // Validasi akses (sama seperti POST)
    if (targetTeacherId !== session.id && !['admin', 'kepala_sekolah', 'wakasek', 'operator'].includes(session.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (targetTeacherId !== session.id && (session.role || '') !== 'admin') {
      const membersResult2 = await query(`
        SELECT institution_id as "institutionId"
        FROM public.institution_members
        WHERE app_user_id = $1 AND status = 'active'
      `, [session.id]);
      const userInstitutionMembers = membersResult2.rows;

      const assignmentsResult3 = await query(`
        SELECT institution_id as "institutionId"
        FROM public.institution_members
        WHERE app_user_id = $1 AND status = 'active'
      `, [targetTeacherId]);
      const teacherAssignments = assignmentsResult3.rows;

      const hasAccess = teacherAssignments.some(assignment => 
        userInstitutionMembers.some(member => Number(member.institutionId) === assignment.institutionId)
      );

      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses ke data guru ini' }, { status: 403 });
      }
    }

    // Ambil insight dari database
    const insights = await db.select()
      .from(attendanceInsightsTable)
      .where(and(
        eq(attendanceInsightsTable.teacherId, targetTeacherId),
        eq(attendanceInsightsTable.periodType, periodType),
        eq(attendanceInsightsTable.periodStart, parseISO(periodStart)),
        eq(attendanceInsightsTable.periodEnd, parseISO(periodEnd))
      ));

    return NextResponse.json({
      success: true,
      insights,
    });
  } catch (error) {
    console.error('Get attendance insight error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validasi parameter gagal', 
          details: error.issues 
        }, 
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}