import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';

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
 * GET /api/teaching-session
 * Get today's teaching session status
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's session (prefer completed one if multiple exist)
    const todaySession =
      (await prisma.teaching_sessions.findFirst({
        where: {
          user_id: userId,
          session_date: today,
          status: 'completed',
        },
        orderBy: { completed_at: 'desc' },
      })) ??
      (await prisma.teaching_sessions.findFirst({
        where: {
          user_id: userId,
          session_date: today,
        },
        orderBy: { created_at: 'desc' },
      }));

    // Get pending tasks
    const pendingTasks = await prisma.admin_tasks.findMany({
      where: {
        user_id: userId,
        status: 'pending',
        due_date: {
          lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // This week
        },
      },
      orderBy: {
        due_date: 'asc',
      },
      take: 5,
    });

    // Get today's schedule
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = dayNames[today.getDay()];

    const todaySchedules = await prisma.schedules.findMany({
      where: {
        schools: {
          user_id: userId,
        },
        hari: dayName,
      },
      include: {
        classes: true,
        subjects: true,
        schools: true,
      },
    });

    // Per-schedule completion: a schedule is "done" when a completed
    // teaching session exists for it today (not the reverse — one global
    // session must NOT mark every schedule as completed).
    const completedSessions = await prisma.teaching_sessions.findMany({
      where: {
        user_id: userId,
        session_date: today,
        status: 'completed',
        schedule_id: { not: null },
      },
      select: { schedule_id: true },
    });
    const completedScheduleIds = new Set(
      completedSessions.map((s) => s.schedule_id).filter(Boolean)
    );

    const schedulesWithStatus = todaySchedules.map((s) => ({
      ...s,
      isCompleted: completedScheduleIds.has(s.id),
    }));

    return NextResponse.json({
      session: todaySession || null,
      pendingTasks,
      todaySchedules: schedulesWithStatus,
      date: today.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('Error fetching teaching session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/teaching-session
 * Start a new teaching session
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const body = await request.json();

    const { schedule_id, class_id, subject_id, school_id, session_date } = body;

    if (!schedule_id || !class_id || !subject_id || !school_id) {
      return NextResponse.json(
        { error: 'Missing required fields: schedule_id, class_id, subject_id, school_id' },
        { status: 400 }
      );
    }

    const date = session_date ? new Date(session_date) : new Date();
    date.setHours(0, 0, 0, 0);

    // Check if session already exists
    const existingSession = await prisma.teaching_sessions.findFirst({
      where: {
        user_id: userId,
        session_date: date,
        schedule_id,
      },
    });

    if (existingSession) {
      return NextResponse.json({
        message: 'Session already exists',
        session: existingSession,
      });
    }

    // Create new session
    const newSession = await prisma.teaching_sessions.create({
      data: {
        user_id: userId,
        schedule_id,
        class_id,
        subject_id,
        school_id,
        session_date: date,
        status: 'in_progress',
      },
    });

    // Create pending task for journal
    await prisma.admin_tasks.create({
      data: {
        user_id: userId,
        task_type: 'jurnal',
        task_title: 'Isi Jurnal Mengajar',
        related_id: newSession.id,
        status: 'pending',
        due_date: date,
        priority: 'high',
        description: 'Lengkapi administrasi jurnal mengajar hari ini',
      },
    });

    return NextResponse.json({
      message: 'Teaching session started',
      session: newSession,
    });
  } catch (error) {
    console.error('Error creating teaching session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}