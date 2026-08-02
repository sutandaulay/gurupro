/**
 * GET /api/laporan-mengajar
 * List teaching reports for the current guru
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session');
  if (!sessionCookie?.value) return null;
  try {
    return JSON.parse(sessionCookie.value);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build date filter
    let dateFilter: { gte?: Date; lte?: Date } = {};
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { gte: today, lte: now };
    } else if (period === 'week') {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      dateFilter = { gte: weekStart, lte: now };
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      dateFilter = { gte: monthStart, lte: now };
    } else if (dateFrom || dateTo) {
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        dateFilter.gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.lte = to;
      }
    }

    const whereClause: any = { user_id: user.id };
    if (Object.keys(dateFilter).length > 0) {
      whereClause.tanggal = dateFilter;
    }

    const [journals, total] = await Promise.all([
      prisma.teacher_journals.findMany({
        where: whereClause,
        include: {
          classes: { select: { nama_kelas: true } },
          subjects: { select: { nama_mapel: true } },
          schools: { select: { nama_sekolah: true } },
        },
        orderBy: { tanggal: 'desc' },
        skip,
        take: limit,
      }),
      prisma.teacher_journals.count({ where: whereClause }),
    ]);

    // Fetch attendance for each journal
    const journalIds = journals.map(j => j.id);
    const sessions = await prisma.teaching_sessions.findMany({
      where: {
        user_id: user.id,
        session_date: { in: journals.map(j => j.tanggal) },
      },
      select: {
        user_id: true,
        session_date: true,
        attendance_data: true,
        class_id: true,
        subject_id: true,
      },
    });

    const sessionMap = new Map(
      sessions.map(s => [`${s.user_id}-${s.class_id}-${s.subject_id}-${s.session_date.toISOString().split('T')[0]}`, s])
    );

    const reports = journals.map(journal => {
      const key = `${journal.user_id}-${journal.class_id}-${journal.subject_id}-${journal.tanggal.toISOString().split('T')[0]}`;
      const session = sessionMap.get(key);
      let attendance = null;
      if (session?.attendance_data) {
        try {
          attendance = typeof session.attendance_data === 'string'
            ? JSON.parse(session.attendance_data)
            : session.attendance_data;
        } catch {}
      }
      const customValues = typeof journal.custom_values === 'string'
        ? JSON.parse(journal.custom_values)
        : (journal.custom_values || {});

      return {
        id: journal.id,
        tanggal: journal.tanggal.toISOString().split('T')[0],
        kelas: journal.classes?.nama_kelas || '-',
        mapel: journal.subjects?.nama_mapel || '-',
        sekolah: journal.schools?.nama_sekolah || '-',
        materi: journal.materi_pembelajaran?.substring(0, 100),
        status: journal.status,
        attendance,
        pdf_url: customValues.pdf_url || null,
        docx_url: customValues.docx_url || null,
      };
    });

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[laporan-mengajar] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
