/**
 * SSE Streaming API for "Selesaikan Mengajar"
 * POST /api/selesai-mengajar
 *
 * Runs all tasks in parallel and streams progress in real-time
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { PrismaClient } from '@prisma/client';
import { generateAndSaveJurnal } from '@/lib/selesai-mengajar/generate-jurnal';
import { saveAbsensiSummary } from '@/lib/selesai-mengajar/save-absensi';
import { updateProgressATP } from '@/lib/selesai-mengajar/update-atp';
import { updateLessonMemory } from '@/lib/selesai-mengajar/update-memory';
import { generateNextMateri } from '@/lib/selesai-mengajar/generate-next-materi';
import type { SelesaiMengajarInput, ProgressEvent, SelesaiMengajarResult } from '@/lib/selesai-mengajar/types';

const prisma = new PrismaClient();

/**
 * Helper to get school ID for a user
 */
async function getSchoolIdForUser(userId: string): Promise<string | null> {
  // Try to find school by user_id
  const school = await prisma.schools.findFirst({
    where: { user_id: userId },
  });
  if (school) return school.id;

  // If not found, check if user has created any school through classes/subjects
  const userClass = await prisma.classes.findFirst({
    where: { schools: { user_id: userId } },
  });
  if (userClass) return userClass.school_id;

  return null;
}

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
 * Send SSE event
 */
function sendEvent(controller: ReadableStreamDefaultController, event: ProgressEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(new TextEncoder().encode(data));
}

/**
 * POST /api/selesai-mengajar
 * SSE Streaming endpoint for parallel task execution
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guruId = user.id;
    const body: SelesaiMengajarInput = await request.json();

    // Validate required fields
    if (!body.kelas_id || !body.mapel_id || !body.tanggal) {
      return NextResponse.json(
        { error: 'Missing required fields: kelas_id, mapel_id, tanggal' },
        { status: 400 }
      );
    }

    // Get guru name
    const guru = await prisma.users.findUnique({
      where: { id: guruId },
      select: { nama_lengkap: true },
    });
    const guruName = guru?.nama_lengkap || 'Guru';

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const errors: string[] = [];

        try {
          // Step 0: Start
          sendEvent(controller, {
            step: 'start',
            status: 'done',
            message: 'Memulai proses administrasi...',
          });

          // Prepare input with school_id
          const inputData: SelesaiMengajarInput = {
            ...body,
            guru_id: guruId,
            school_id: body.school_id || user.school_id || '',
          };

          // PARALLEL TASKS - Run all in parallel using Promise.allSettled
          // This ensures one failure doesn't cancel others

          // Task 1: Generate Jurnal
          sendEvent(controller, {
            step: 'jurnal',
            status: 'loading',
            message: 'Mengisi jurnal mengajar...',
          });
          const jurnalPromise = generateAndSaveJurnal(inputData, guruName);

          // Task 2: Save Absensi
          sendEvent(controller, {
            step: 'absensi',
            status: 'loading',
            message: 'Menyimpan data kehadiran...',
          });
          const absensiPromise = saveAbsensiSummary(inputData);

          // Task 3: Update ATP
          sendEvent(controller, {
            step: 'atp',
            status: 'loading',
            message: 'Memperbarui progres ATP...',
          });
          const atpPromise = updateProgressATP(inputData);

          // Task 4: Update Lesson Memory
          sendEvent(controller, {
            step: 'memory',
            status: 'loading',
            message: 'Menyimpan lesson memory...',
          });
          const memoryPromise = updateLessonMemory(inputData);

          // Task 5: Generate Next Materi
          sendEvent(controller, {
            step: 'next',
            status: 'loading',
            message: 'Menyiapkan materi pertemuan berikutnya...',
          });
          const nextMateriPromise = generateNextMateri(inputData);

          // Wait for all tasks to complete
          const results = await Promise.allSettled([
            jurnalPromise,
            absensiPromise,
            atpPromise,
            memoryPromise,
            nextMateriPromise,
          ]);

          // Extract results and report status
          const [jurnalResult, absensiResult, atpResult, memoryResult, nextMateriResult] = results;

          // Report jurnal status
          if (jurnalResult.status === 'fulfilled') {
            sendEvent(controller, {
              step: 'jurnal',
              status: 'done',
              message: 'Jurnal mengajar tersimpan',
              data: jurnalResult.value,
            });
          } else {
            errors.push(`Jurnal: ${jurnalResult.reason?.message}`);
            sendEvent(controller, {
              step: 'jurnal',
              status: 'error',
              message: 'Gagal membuat jurnal',
            });
          }

          // Report absensi status
          if (absensiResult.status === 'fulfilled') {
            sendEvent(controller, {
              step: 'absensi',
              status: 'done',
              message: `${absensiResult.value.count} data kehadiran tersimpan`,
              data: absensiResult.value,
            });
          } else {
            errors.push(`Absensi: ${absensiResult.reason?.message}`);
            sendEvent(controller, {
              step: 'absensi',
              status: 'error',
              message: 'Gagal menyimpan absensi',
            });
          }

          // Report ATP status
          if (atpResult.status === 'fulfilled' && atpResult.value) {
            sendEvent(controller, {
              step: 'atp',
              status: 'done',
              message: `Progress ATP minggu ke-${atpResult.value.progress_minggu}`,
              data: atpResult.value,
            });
          } else {
            sendEvent(controller, {
              step: 'atp',
              status: 'done',
              message: 'ATP tidak ditemukan (lewati)',
            });
          }

          // Report memory status
          if (memoryResult.status === 'fulfilled' && memoryResult.value) {
            sendEvent(controller, {
              step: 'memory',
              status: 'done',
              message: 'Lesson memory diperbarui',
              data: memoryResult.value,
            });
          } else {
            sendEvent(controller, {
              step: 'memory',
              status: 'done',
              message: 'Lesson memory tidak tersedia',
            });
          }

          // Report next materi status
          if (nextMateriResult.status === 'fulfilled' && nextMateriResult.value) {
            sendEvent(controller, {
              step: 'next',
              status: 'done',
              message: 'Materi berikutnya siap',
              data: nextMateriResult.value,
            });
          } else {
            sendEvent(controller, {
              step: 'next',
              status: 'done',
              message: 'Saran materi tidak tersedia',
            });
          }

          // Build final result
          const finalResult: SelesaiMengajarResult = {
            jurnal: jurnalResult.status === 'fulfilled' ? jurnalResult.value : null,
            absensi_summary: {
              hadir: body.jumlah_hadir,
              izin: body.jumlah_izin,
              sakit: body.jumlah_sakit,
              alpha: body.jumlah_alpha,
              total: body.jumlah_hadir + body.jumlah_izin + body.jumlah_sakit + body.jumlah_alpha,
            },
            atp_updated: atpResult.status === 'fulfilled' ? atpResult.value : null,
            memory_updated: memoryResult.status === 'fulfilled' ? memoryResult.value : null,
            next_materi: nextMateriResult.status === 'fulfilled' ? nextMateriResult.value : null,
            errors,
          };

          // Revalidate caches
          revalidatePath('/dashboard');
          revalidatePath('/api/timeline');
          revalidatePath('/api/teaching-session');

          // Send complete event
          sendEvent(controller, {
            step: 'complete',
            status: 'done',
            message: 'Semua administrasi selesai! 🎉',
            data: finalResult,
          });

          controller.close();
        } catch (error: any) {
          console.error('Selesai Mengajar Error:', error);
          sendEvent(controller, {
            step: 'error',
            status: 'error',
            message: `Terjadi kesalahan: ${error.message}`,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/selesai-mengajar
 * Get today's teaching sessions and schedules
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all schools for this user
    const userSchools = await prisma.schools.findMany({
      where: { user_id: user.id },
      select: { id: true, nama_sekolah: true },
    });

    // If no schools found via user_id, try looking through classes
    let allSchoolIds: string[] = userSchools.map((s) => s.id);
    if (allSchoolIds.length === 0) {
      const userClasses = await prisma.classes.findMany({
        where: { schools: { user_id: user.id } },
        select: { school_id: true },
        distinct: ['school_id'],
      });
      allSchoolIds = [...new Set(userClasses.map((c) => c.school_id))];
    }

    const schoolMap = new Map(userSchools.map((s) => [s.id, s.nama_sekolah]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = dayNames[today.getDay()];

    const todaySchedules = await prisma.schedules.findMany({
      where: {
        school_id: allSchoolIds.length > 0 ? { in: allSchoolIds } : undefined,
        hari: hariIni,
      },
      include: {
        classes: { select: { nama_kelas: true } },
        subjects: { select: { nama_mapel: true } },
        schools: { select: { nama_sekolah: true } },
      },
      orderBy: [{ school_id: 'asc' }, { jam_mulai: 'asc' }],
    });

    const completedSessions = await prisma.teaching_sessions.findMany({
      where: {
        user_id: user.id,
        session_date: today,
        status: 'completed',
      },
      select: { schedule_id: true, journal_generated: true },
    });

    const completedMap = new Map(
      completedSessions.map((s) => [s.schedule_id, s.journal_generated])
    );

    const availableSchedules = todaySchedules
      .filter((s) => !completedMap.get(s.id))
      .map((s) => ({
        id: s.id,
        class_id: s.class_id,
        subject_id: s.subject_id,
        school_id: s.school_id,
        school_name: s.schools?.nama_sekolah || schoolMap.get(s.school_id) || '',
        class_name: s.classes.nama_kelas,
        subject_name: s.subjects.nama_mapel,
        jam_mulai: s.jam_mulai,
        jam_selesai: s.jam_selesai,
      }));

    return NextResponse.json({
      schedules: availableSchedules,
      allSchedules: todaySchedules.map((s) => ({
        id: s.id,
        class_id: s.class_id,
        subject_id: s.subject_id,
        school_id: s.school_id,
        school_name: s.schools?.nama_sekolah || schoolMap.get(s.school_id) || '',
        class_name: s.classes.nama_kelas,
        subject_name: s.subjects.nama_mapel,
        jam_mulai: s.jam_mulai,
        jam_selesai: s.jam_selesai,
        isCompleted: completedMap.get(s.id) || false,
      })),
    });
  } catch (error: any) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}