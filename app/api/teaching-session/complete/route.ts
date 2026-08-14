import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionCookie } from '@/lib/session-sign';
import { PrismaClient } from '@prisma/client';
import { generateJournal, generateReflection, estimateCost } from '@/lib/ai/generators';
import { getUserPoinAccess } from '@/src/services/poin-service';
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
    return parseSessionCookie(sessionCookie.value);
  } catch {
    return null;
  }
}

/**
 * POST /api/teaching-session/complete
 * Complete teaching session with auto-generation of journal, reflection, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const body = await request.json();

    // Poin check (non-admin) sebelum generate AI
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

    const {
      session_id,
      schedule_id,
      class_id,
      subject_id,
      school_id,
      attendance_data,
      materi_input,
      catatan_guru,
      save_journal = true,
      generate_reflection = true,
    } = body;

    // Get user info
    const userData = await prisma.users.findUnique({
      where: { id: userId },
      select: { nama_lengkap: true, nama_sekolah: true },
    });

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get class and subject info
    const [classInfo, subjectInfo] = await Promise.all([
      prisma.classes.findUnique({ where: { id: class_id } }),
      prisma.subjects.findUnique({ where: { id: subject_id } }),
    ]);

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const formattedDate = today.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Count attendance
    const hadirCount = attendance_data?.filter((a: any) => a.status === 'Hadir').length || 0;
    const tidakHadirCount = attendance_data?.filter((a: any) => a.status !== 'Hadir').length || 0;

    // Initialize results
    const results: any = {
      journal: null,
      journalDb: null, // Separate storage for Prisma-created journal (has .id)
      reflection: null,
      attendance_saved: false,
      errors: [] as string[],
    };

    // 1. Save attendance records
    if (attendance_data && attendance_data.length > 0) {
      try {
        for (const record of attendance_data) {
          await prisma.student_attendance.upsert({
            where: {
              id: `${record.student_id}-${today.toISOString().split('T')[0]}`,
            },
            update: {
              status: record.status,
              catatan: record.catatan || null,
            },
            create: {
              id: `${record.student_id}-${today.toISOString().split('T')[0]}`,
              schedule_id: schedule_id,
              student_id: record.student_id,
              tanggal: today,
              status: record.status,
              catatan: record.catatan || null,
            },
          });
        }
        results.attendance_saved = true;
      } catch (err) {
        results.errors.push('Gagal menyimpan absensi');
      }
    }

    // 2. Generate Journal with AI
    let journalData: any = null;
    if (save_journal) {
      try {
        const journalResult = await generateJournal({
          nama_guru: userData.nama_lengkap,
          mapel: subjectInfo?.nama_mapel || '',
          kelas: classInfo?.nama_kelas || '',
          tanggal: formattedDate,
          materi: materi_input,
          jumlah_siswa_hadir: hadirCount,
          jumlah_siswa_tidak_hadir: tidakHadirCount,
          catatan_guru,
          jenjang: 'SMA', // Could be dynamic based on school type
        });

        if (journalResult.success && journalResult.data) {
          // Save journal to database
          const journal = await prisma.teacher_journals.create({
            data: {
              user_id: userId,
              school_id: school_id,
              schedule_id: schedule_id,
              class_id: class_id,
              subject_id: subject_id,
              tanggal: today,
              materi_pembelajaran: journalResult.data.materi_pembelajaran || materi_input || '',
              tujuan_pembelajaran: journalResult.data.tujuan_pembelajaran?.join('\n') || '',
              aktivitas_pembelajaran: journalResult.data.aktivitas_pembelajaran || '',
              media_pembelajaran: journalResult.data.media_pembelajaran || '',
              asesmen_pembelajaran: journalResult.data.asesmen_pembelajaran || '',
              refleksi_guru: journalResult.data.refleksi_guru || '',
              tindak_lanjut: journalResult.data.tindak_lanjut || '',
              status: 'Draft',
              auto_generated: true,
              source_schedule_id: schedule_id,
            },
          });

          results.journal = journalResult; // Keep full result (has .usage for Poin)
          results.journalDb = journal; // Prisma-created record (has .id)
          journalData = journalResult.data;

          // Track token usage
          if (journalResult.usage) {
            const cost = estimateCost(journalResult.usage);
            console.log(`Journal generation cost: Rp ${cost.totalCost}`);
          }
        } else {
          results.errors.push(`Gagal generate jurnal: ${journalResult.error}`);
        }
      } catch (err: any) {
        results.errors.push(`Error generating journal: ${err.message}`);
      }
    }

    // 3. Generate Reflection with AI
    if (generate_reflection && journalData) {
      try {
        const reflectionResult = await generateReflection({
          nama_guru: userData.nama_lengkap,
          mapel: subjectInfo?.nama_mapel || '',
          kelas: classInfo?.nama_kelas || '',
          materi: journalData.materi_pembelajaran || '',
          aktivitas: journalData.aktivitas_pembelajaran || '',
          jumlah_hadir: hadirCount,
          jumlah_tidak_hadir: tidakHadirCount,
          catatan: catatan_guru,
        });

        if (reflectionResult.success && reflectionResult.data) {
          results.reflection = reflectionResult; // Keep full result (has .usage for Poin)
        }
      } catch (err: any) {
        results.errors.push(`Error generating reflection: ${err.message}`);
      }
    }

    // 4. Update or create teaching session
    const sessionData: any = {
      user_id: userId,
      schedule_id,
      class_id,
      subject_id,
      school_id,
      session_date: today,
      status: 'completed',
      attendance_completed: results.attendance_saved,
      journal_generated: !!results.journalDb,
      reflection_generated: !!results.reflection,
      attendance_data: JSON.stringify(attendance_data || []),
      journal_id: results.journalDb?.id,
      completed_at: new Date(),
    };

    let teachingSession;
    if (session_id) {
      teachingSession = await prisma.teaching_sessions.update({
        where: { id: session_id },
        data: sessionData,
      });
    } else {
      teachingSession = await prisma.teaching_sessions.create({
        data: sessionData,
      });
    }

    // 5. Mark related tasks as completed
    await prisma.admin_tasks.updateMany({
      where: {
        user_id: userId,
        related_id: session_id || teachingSession.id,
        task_type: 'jurnal',
        status: 'pending',
      },
      data: {
        status: 'completed',
        completed_at: new Date(),
      },
    });

    // 6. Update lesson memory
    if (results.journalDb && schedule_id) {
      await prisma.lesson_memories.upsert({
        where: {
          id: `${userId}-${schedule_id}`,
        },
        update: {
          last_topic: subjectInfo?.nama_mapel || '',
          last_subtopic: journalData?.materi_pembelajaran?.substring(0, 255) || '',
          last_date: today,
          updated_at: new Date(),
        },
        create: {
          id: `${userId}-${schedule_id}`,
          user_id: userId,
          schedule_id: schedule_id,
          last_topic: subjectInfo?.nama_mapel || '',
          last_subtopic: journalData?.materi_pembelajaran?.substring(0, 255) || '',
          last_date: today,
        },
      });
    }

    // Deduct Poin only if AI was actually used (results have usage data)
    const journalUsage = (results.journal as any)?.usage || null;
    const reflectionUsage = (results.reflection as any)?.usage || null;
    if (userDb?.role !== 'admin' && (journalUsage || reflectionUsage)) {
      try {
        // Deduct journal usage
        if (journalUsage) {
          await deductPoinFromAIResult(
            { success: true, usage: journalUsage },
            userId,
            'selesai-mengajar',
            {}
          );
        }

        // Deduct reflection usage
        if (reflectionUsage) {
          await deductPoinFromAIResult(
            { success: true, usage: reflectionUsage },
            userId,
            'selesai-mengajar',
            {}
          );
        }

        console.log(`[Teaching Session] Poin deducted for journal + reflection`);
      } catch (poinError) {
        console.error('[Teaching Session] Poin deduction failed:', poinError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Teaching session completed',
      session: teachingSession,
      results,
    });
  } catch (error: any) {
    console.error('Error completing teaching session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}