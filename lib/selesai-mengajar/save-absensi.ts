/**
 * Save Attendance Summary
 * Part of Selesai Mengajar pipeline
 */

import { PrismaClient } from '@prisma/client';
import type { SelesaiMengajarInput, AbsensiResult } from './types';
import { parseLocalDate } from '@/lib/utils';

const prisma = new PrismaClient();

export async function saveAbsensiSummary(
  data: SelesaiMengajarInput,
): Promise<AbsensiResult> {
  const today = parseLocalDate(data.tanggal);

  const results = {
    saved: false,
    count: 0,
  };

  try {
    // Save per-student attendance for ALL statuses
    const attendanceList = data.student_attendance?.length
      ? data.student_attendance
      : (data.student_ids || []).map((studentId) => ({ studentId, status: 'Hadir', catatan: '' }));

    if (attendanceList.length > 0) {
      for (const record of attendanceList) {
        const existingRecord = await prisma.student_attendance.findFirst({
          where: {
            student_id: record.studentId,
            tanggal: today,
            schedule_id: data.schedule_id || undefined,
          },
        });

        if (existingRecord) {
          await prisma.student_attendance.update({
            where: { id: existingRecord.id },
            data: { status: record.status, catatan: record.catatan || null },
          });
        } else {
          await prisma.student_attendance.create({
            data: {
              schedule_id: data.schedule_id || '',
              student_id: record.studentId,
              tanggal: today,
              status: record.status,
              catatan: record.catatan || null,
            },
          });
        }
      }
      results.count = attendanceList.length;
    }

    // Save summary to teaching session and mark it completed
    const attendanceSummary = {
      hadir: data.jumlah_hadir,
      izin: data.jumlah_izin,
      sakit: data.jumlah_sakit,
      alpha: data.jumlah_alpha,
      total: data.student_ids.length || data.jumlah_hadir + data.jumlah_izin + data.jumlah_sakit + data.jumlah_alpha,
    };

    const existingSession = await prisma.teaching_sessions.findFirst({
      where: {
        user_id: data.guru_id,
        session_date: today,
        ...(data.schedule_id ? { schedule_id: data.schedule_id } : {}),
      },
    });

    const sessionData = {
      user_id: data.guru_id,
      schedule_id: data.schedule_id || null,
      class_id: data.kelas_id,
      subject_id: data.mapel_id,
      session_date: today,
      status: 'completed',
      attendance_completed: true,
      attendance_data: JSON.stringify(attendanceSummary),
      completed_at: new Date(),
    };

    if (existingSession) {
      await prisma.teaching_sessions.update({
        where: { id: existingSession.id },
        data: sessionData,
      });
    } else {
      await prisma.teaching_sessions.create({
        data: sessionData,
      });
    }

    results.saved = true;
    return results;
  } catch (error: any) {
    console.error('Error saving attendance:', error);
    throw new Error(`Gagal menyimpan absensi: ${error.message}`);
  }
}