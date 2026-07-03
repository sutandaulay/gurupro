/**
 * Save Attendance Summary
 * Part of Selesai Mengajar pipeline
 */

import { PrismaClient } from '@prisma/client';
import type { SelesaiMengajarInput, AbsensiResult } from './types';

const prisma = new PrismaClient();

export async function saveAbsensiSummary(
  data: SelesaiMengajarInput,
  studentIds: string[] = []
): Promise<AbsensiResult> {
  const today = new Date(data.tanggal);
  today.setHours(0, 0, 0, 0);

  const results = {
    saved: false,
    count: 0,
  };

  try {
    // If we have individual student IDs, save per-student attendance
    if (studentIds.length > 0) {
      const attendanceRecords = studentIds.map((studentId) => {
        const status = 'Hadir';
        // Determine status based on counts (simplified - in real app would map to specific students)
        // For summary-based approach, we just track counts
        return {
          id: `${studentId}-${data.tanggal}`,
          schedule_id: data.schedule_id || '',
          student_id: studentId,
          tanggal: today,
          status,
          catatan: null,
        };
      });

      // Upsert all records
      for (const record of attendanceRecords) {
        await prisma.student_attendance.upsert({
          where: { id: record.id },
          update: { status: record.status },
          create: record,
        });
      }
      results.count = attendanceRecords.length;
    }

    // Also save summary to teaching session for reference
    const sessionId = `${data.guru_id}-${data.tanggal}`;
    await prisma.teaching_sessions.upsert({
      where: { id: sessionId },
      update: {
        attendance_data: JSON.stringify({
          hadir: data.jumlah_hadir,
          izin: data.jumlah_izin,
          sakit: data.jumlah_sakit,
          alpha: data.jumlah_alpha,
          total: studentIds.length || data.jumlah_hadir + data.jumlah_izin + data.jumlah_sakit + data.jumlah_alpha,
        }),
        attendance_completed: true,
      },
      create: {
        id: sessionId,
        user_id: data.guru_id,
        schedule_id: data.schedule_id || null,
        class_id: data.kelas_id,
        subject_id: data.mapel_id,
        session_date: today,
        status: 'pending',
        attendance_completed: true,
        attendance_data: JSON.stringify({
          hadir: data.jumlah_hadir,
          izin: data.jumlah_izin,
          sakit: data.jumlah_sakit,
          alpha: data.jumlah_alpha,
        }),
      },
    });

    results.saved = true;
    return results;
  } catch (error: any) {
    console.error('Error saving attendance:', error);
    throw new Error(`Gagal menyimpan absensi: ${error.message}`);
  }
}