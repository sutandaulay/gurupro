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
import { query } from '@/lib/db';
import { generateAndSaveJurnal } from '@/lib/selesai-mengajar/generate-jurnal';
import { saveAbsensiSummary } from '@/lib/selesai-mengajar/save-absensi';
import { updateProgressATP } from '@/lib/selesai-mengajar/update-atp';
import { updateLessonMemory } from '@/lib/selesai-mengajar/update-memory';
import { generateNextMateri } from '@/lib/selesai-mengajar/generate-next-materi';
import { getUserPoinAccess, consumeUserPoinFromUsage } from '@/src/services/poin-service';
import { sendTeachingReportNotification } from '@/lib/notifications';
import type { SelesaiMengajarInput, ProgressEvent, SelesaiMengajarResult } from '@/lib/selesai-mengajar/types';

const prisma = new PrismaClient();

/**
 * Helper to get school ID for a user
 */
async function getSchoolIdForUser(userId: string): Promise<string | null> {
  const school = await prisma.schools.findFirst({
    where: { user_id: userId },
  });
  if (school) return school.id;

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

    const userDb = await prisma.users.findUnique({
      where: { id: user.id },
      select: { role: true, status_langganan: true, subscription_end: true },
    });

    const isPro = userDb?.status_langganan && userDb.status_langganan !== 'free';
    const isExpired = isPro && userDb.subscription_end && new Date(userDb.subscription_end).getTime() < Date.now();

    const guruId = user.id;
    const body: SelesaiMengajarInput = await request.json();

    // Validate required fields
    if (!body.kelas_id || !body.mapel_id || !body.tanggal) {
      return NextResponse.json(
        { error: 'Missing required fields: kelas_id, mapel_id, tanggal' },
        { status: 400 }
      );
    }

    // Determine if AI tasks should run (based on checkbox and poin availability)
    // AI check is deferred to here so non-AI data (absensi, ATP, memory) is always saved
    const useAI = body.save_journal !== false;
    let aiAllowed = useAI;
    let aiBlockedReason: string | null = null;

    if (useAI && userDb?.role !== 'admin') {
      if (isExpired) {
        aiAllowed = false;
        aiBlockedReason = 'Masa aktif langganan Anda telah habis. Jurnal AI dilewati, namun absensi tetap disimpan.';
      } else {
        const poinAccess = await getUserPoinAccess(guruId);
        if (!poinAccess.access.allowed) {
          aiAllowed = false;
          aiBlockedReason =
            poinAccess.access.reason === 'subscription_expired'
              ? 'Masa aktif langganan Anda telah habis. Jurnal AI dilewati, namun absensi tetap disimpan.'
              : 'Poin GuruPRO Anda telah habis. Jurnal AI dilewati, namun absensi tetap disimpan.';
        }
      }
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

          // Warn if AI blocked but non-AI tasks will proceed
          if (!useAI) {
            sendEvent(controller, {
              step: 'jurnal',
              status: 'done',
              message: 'Pembuatan jurnal AI dilewati (dimatikan pengguna)',
            });
            sendEvent(controller, {
              step: 'next',
              status: 'done',
              message: 'Saran materi AI dilewati (dimatikan pengguna)',
            });
          } else if (!aiAllowed && aiBlockedReason) {
            errors.push(aiBlockedReason);
            sendEvent(controller, {
              step: 'jurnal',
              status: 'error',
              message: aiBlockedReason,
            });
            sendEvent(controller, {
              step: 'next',
              status: 'error',
              message: 'Saran materi AI dilewati (poin/paket tidak mencukupi)',
            });
          }

          // PARALLEL TASKS
          const inputData: SelesaiMengajarInput = {
            ...body,
            guru_id: guruId,
            school_id: body.school_id || user.school_id || '',
          };

          // PARALLEL TASKS - Run all in parallel using Promise.allSettled
          // This ensures one failure doesn't cancel others

          // Task 1: Generate Jurnal (AI task - skip if disabled or poin insufficient)
          let jurnalPromise: Promise<any>;
          if (useAI && aiAllowed) {
            sendEvent(controller, {
              step: 'jurnal',
              status: 'loading',
              message: 'Mengisi jurnal mengajar...',
            });
            jurnalPromise = generateAndSaveJurnal(inputData, guruName);
          } else {
            jurnalPromise = Promise.resolve(null);
          }

          // Task 2: Save Absensi (always)
          sendEvent(controller, {
            step: 'absensi',
            status: 'loading',
            message: 'Menyimpan data kehadiran...',
          });
          const absensiPromise = saveAbsensiSummary(inputData);

          // Task 3: Update ATP (always)
          sendEvent(controller, {
            step: 'atp',
            status: 'loading',
            message: 'Memperbarui progres ATP...',
          });
          const atpPromise = updateProgressATP(inputData);

          // Task 4: Update Lesson Memory (always)
          sendEvent(controller, {
            step: 'memory',
            status: 'loading',
            message: 'Menyimpan lesson memory...',
          });
          const memoryPromise = updateLessonMemory(inputData);

          // Task 5: Generate Next Materi (AI task - skip if disabled or poin insufficient)
          let nextMateriPromise: Promise<any>;
          if (useAI && aiAllowed) {
            sendEvent(controller, {
              step: 'next',
              status: 'loading',
              message: 'Menyiapkan materi pertemuan berikutnya...',
            });
            nextMateriPromise = generateNextMateri(inputData);
          } else {
            nextMateriPromise = Promise.resolve(null);
          }

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
          if (jurnalResult.status === 'fulfilled' && jurnalResult.value) {
            sendEvent(controller, {
              step: 'jurnal',
              status: 'done',
              message: 'Jurnal mengajar tersimpan',
              data: jurnalResult.value,
            });
          } else if (jurnalResult.status === 'fulfilled') {
            sendEvent(controller, {
              step: 'jurnal',
              status: 'done',
              message: 'Jurnal AI dilewati',
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
          } else if (nextMateriResult.status === 'fulfilled') {
            sendEvent(controller, {
              step: 'next',
              status: 'done',
              message: 'Saran materi AI dilewati',
            });
          } else {
            errors.push(`NextMateri: ${nextMateriResult.reason?.message}`);
            sendEvent(controller, {
              step: 'next',
              status: 'error',
              message: 'Gagal menyiapkan materi berikutnya',
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

          // Deduct Poin hanya jika AI digunakan (jurnal AI generated)
          // Cek apakah jurnal berhasil dibuat dengan AI (bukan skip/error)
          const jurnalGenerated = jurnalResult.status === 'fulfilled' && jurnalResult.value?.ai_generated === true;
          const nextMateriGenerated = nextMateriResult.status === 'fulfilled' && nextMateriResult.value?.ai_generated === true;
          const aiUsed = jurnalGenerated || nextMateriGenerated;

          if (aiUsed && userDb?.role !== 'admin') {
            try {
              // Estimasi token berdasarkan jenis AI yang digunakan
              const inputTokens = jurnalGenerated && nextMateriGenerated ? 1500 : 800;
              const outputTokens = jurnalGenerated && nextMateriGenerated ? 3000 : 1500;
              const estimatedUsage = { inputTokens, outputTokens };
              await consumeUserPoinFromUsage(guruId, estimatedUsage as any, "selesai-mengajar", {
                mapel: body.mapel_nama || '-',
                jenjang: body.jenjang || '-',
              });
              console.log(`[Selesai Mengajar] Poin deducted (AI used: jurnal=${jurnalGenerated}, nextMateri=${nextMateriGenerated})`);
            } catch (poinErr) {
              console.error('[Selesai Mengajar] Poin deduction failed:', poinErr);
            }
          }

          // Revalidate caches
          revalidatePath('/dashboard');
          revalidatePath('/api/timeline');
          revalidatePath('/api/teaching-session');

          // Tutup sesi mengajar sekolah yang masih aktif (dimulai via presensi guru)
          if (inputData.school_id) {
            query(
              `UPDATE school_teaching_sessions
               SET status = 'completed', ended_at = COALESCE(ended_at, NOW())
               WHERE user_id = $1 AND school_id = $2 AND status = 'active'`,
              [guruId, inputData.school_id]
            ).catch((closeErr) => {
              console.error('[Selesai Mengajar] Failed to close school teaching session:', closeErr);
            });
          }

          // Send complete event
          sendEvent(controller, {
            step: 'complete',
            status: 'done',
            message: 'Semua administrasi selesai! 🎉',
            data: finalResult,
          });

          // Resolve institution_id and send notification to kepsek — fire and forget
          const notifPayload = {
            guruId: guruId,
            guruNama: guruName,
            kelas: body.kelas_nama || '-',
            mapel: body.mapel_nama || '-',
            tanggal: body.tanggal,
            kehadiran: `${body.jumlah_hadir} hadir / ${body.jumlah_izin} izin / ${body.jumlah_sakit} sakit / ${body.jumlah_alpha} alpha`,
            reportUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/laporan-mengajar`,
          };

          query(
            `SELECT institution_id FROM payload.institution_members
             WHERE app_user_id = $1 AND status = 'active'
             LIMIT 1`,
            [guruId]
          ).then(membership => {
            if (membership?.rows?.[0]) {
              sendTeachingReportNotification({ ...notifPayload, institutionId: membership.rows[0].institution_id }).catch(() => {});
            }
          }).catch((notifErr) => {
            console.error('[Selesai Mengajar] Failed to resolve institution membership:', notifErr);
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
      let user: any = null;
      try {
        user = await getCurrentUser();
      } catch (e) {
        console.error('[selesai-mengajar] getCurrentUser failed:', e);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      let schedules: any[] = [];
      let allSchedules: any[] = [];

      try {
        let userSchools: { id: string; nama_sekolah: string | null }[] = [];
        try {
          userSchools = await prisma.schools.findMany({
            where: { user_id: user.id },
            select: { id: true, nama_sekolah: true },
          });
        } catch (schoolError) {
          console.error('[selesai-mengajar] Error fetching schools:', schoolError);
        }

        let allSchoolIds: string[] = userSchools.map((s) => s.id);
        if (allSchoolIds.length === 0) {
          try {
            const userClasses = await prisma.classes.findMany({
              where: { schools: { user_id: user.id } },
              select: { school_id: true },
            });
            const uniqueSchoolIds = Array.from(new Set(userClasses.map((c) => c.school_id).filter(Boolean)));
            allSchoolIds = uniqueSchoolIds;
          } catch (classError) {
            console.error('[selesai-mengajar] Error fetching classes:', classError);
          }
        }

        if (allSchoolIds.length === 0) {
          return NextResponse.json({ schedules: [], allSchedules: [] });
        }

        const schoolMap = new Map(userSchools.map((s) => [s.id, s.nama_sekolah]));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const hariIni = dayNames[today.getDay()];

        let todaySchedules: any[] = [];
        try {
          todaySchedules = await prisma.schedules.findMany({
            where: {
              school_id: { in: allSchoolIds },
              hari: hariIni,
            },
            include: {
              classes: { select: { nama_kelas: true } },
              subjects: { select: { nama_mapel: true } },
              schools: { select: { nama_sekolah: true } },
            },
            orderBy: [{ school_id: 'asc' }, { jam_mulai: 'asc' }],
          });
        } catch (scheduleError) {
          console.error('[selesai-mengajar] Error fetching schedules:', scheduleError);
          return NextResponse.json({ schedules: [], allSchedules: [] });
        }

        let completedSessions: { schedule_id: string | null; journal_generated: boolean | null }[] = [];
        try {
          completedSessions = await prisma.teaching_sessions.findMany({
            where: {
              user_id: user.id,
              session_date: today,
              status: 'completed',
            },
            select: { schedule_id: true, journal_generated: true },
          });
        } catch (sessionError) {
          console.error('[selesai-mengajar] Error fetching teaching sessions:', sessionError);
        }

        const completedMap = new Map(
          completedSessions.map((s) => [s.schedule_id, true])
        );

        const safeString = (val: string | null | undefined, fallback = '') => (val && String(val).trim()) ? String(val).trim() : fallback;

        schedules = todaySchedules
          .filter((s) => !completedMap.get(s.id))
          .map((s) => ({
            id: s.id,
            class_id: s.class_id,
            subject_id: s.subject_id,
            school_id: s.school_id,
            school_name: safeString(s.schools?.namaSekolah || schoolMap.get(s.school_id)),
            class_name: safeString(s.classes?.namaKelas),
            subject_name: safeString(s.subjects?.namaMapel),
            jam_mulai: s.jam_mulai,
            jam_selesai: s.jam_selesai,
          }));

        allSchedules = todaySchedules.map((s) => ({
          id: s.id,
          class_id: s.class_id,
          subject_id: s.subject_id,
          school_id: s.school_id,
          school_name: safeString(s.schools?.namaSekolah || schoolMap.get(s.school_id)),
          class_name: safeString(s.classes?.namaKelas),
          subject_name: safeString(s.subjects?.namaMapel),
          jam_mulai: s.jam_mulai,
          jam_selesai: s.jam_selesai,
          isCompleted: completedMap.get(s.id) || false,
        }));
      } catch (processingError) {
        console.error('[selesai-mengajar] Error processing schedule data:', processingError);
        return NextResponse.json({ schedules: [], allSchedules: [] });
      }

      return NextResponse.json({
        schedules,
        allSchedules,
      });
    } catch (error: any) {
      console.error('[selesai-mengajar] GET handler fatal error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }