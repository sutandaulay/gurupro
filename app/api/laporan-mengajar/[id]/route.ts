/**
 * GET /api/laporan-mengajar/[id]
 * Detail of one teaching report
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const journal = await prisma.teacher_journals.findUnique({
      where: { id },
      include: {
        classes: { select: { id: true, nama_kelas: true } },
        subjects: { select: { id: true, nama_mapel: true } },
        schools: { select: { id: true, nama_sekolah: true } },
      },
    });

    if (!journal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Fetch attendance data
    const session = await prisma.teaching_sessions.findFirst({
      where: {
        user_id: user.id,
        class_id: journal.class_id,
        subject_id: journal.subject_id,
        session_date: journal.tanggal,
      },
      select: { attendance_data: true },
    });

    let attendance = null;
    if (session?.attendance_data) {
      try {
        attendance = typeof session.attendance_data === 'string'
          ? JSON.parse(session.attendance_data)
          : session.attendance_data;
      } catch {}
    }

    // Fetch per-student attendance if available
    const studentAttendance = await prisma.student_attendance.findMany({
      where: {
        tanggal: journal.tanggal,
        schedule_id: journal.source_schedule_id || '',
      },
      select: {
        student_id: true,
        status: true,
        catatan: true,
      },
      take: 100,
    });

    const customValues = typeof journal.custom_values === 'string'
      ? JSON.parse(journal.custom_values)
      : (journal.custom_values || {});

    return NextResponse.json({
      id: journal.id,
      tanggal: journal.tanggal.toISOString().split('T')[0],
      guru_id: journal.user_id,
      kelas: {
        id: journal.classes?.id,
        nama: journal.classes?.nama_kelas || '-',
      },
      mapel: {
        id: journal.subjects?.id,
        nama: journal.subjects?.nama_mapel || '-',
      },
      sekolah: {
        id: journal.schools?.id,
        nama: journal.schools?.nama_sekolah || '-',
      },
      materi_pembelajaran: journal.materi_pembelajaran,
      tujuan_pembelajaran: journal.tujuan_pembelajaran,
      aktivitas_pembelajaran: journal.aktivitas_pembelajaran,
      media_pembelajaran: journal.media_pembelajaran,
      asesmen_pembelajaran: journal.asesmen_pembelajaran,
      refleksi_guru: journal.refleksi_guru,
      tindak_lanjut: journal.tindak_lanjut,
      status: journal.status,
      attendance_summary: attendance,
      student_attendance: studentAttendance,
      pdf_url: customValues.pdf_url || null,
      docx_url: customValues.docx_url || null,
    });
  } catch (error: any) {
    console.error('[laporan-mengajar/[id]] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
