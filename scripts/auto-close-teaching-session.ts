import { db } from '@/lib/db';
import { 
  attendanceLogs, 
  attendanceSummary,
  teacherInstitutionAssignments,
  institutions as institutionsTable
} from '@/lib/schemas/attendance';
import { eq, and, isNull, lt } from 'drizzle-orm';
import { subMinutes, differenceInMinutes } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fungsi cron untuk menutup otomatis sesi mengajar yang terlupakan
 * Berjalan setiap 15 menit untuk menutup sesi yang melewati jadwal seharusnya
 */
export async function autoCloseTeachingSessions() {
  try {
    console.log('Memulai proses auto-close sesi mengajar...', new Date());

    // Ambil semua sesi mengajar yang belum ditutup
    const unclosedSessions = await db.select({
      id: attendanceLogs.id,
      teacherId: attendanceLogs.teacherId,
      institutionId: attendanceLogs.institutionId,
      assignmentId: attendanceLogs.assignmentId,
      subjectId: attendanceLogs.subjectId,
      timestamp: attendanceLogs.timestamp,
      classSessionId: attendanceLogs.classSessionId,
      latitude: attendanceLogs.latitude,
      longitude: attendanceLogs.longitude,
    })
    .from(attendanceLogs)
    .where(and(
      eq(attendanceLogs.type, 'mengajar_mulai'),
      isNull(attendanceLogs.classSessionId) // Belum ditutup
    ));

    console.log(`Ditemukan ${unclosedSessions.length} sesi mengajar yang belum ditutup`);

    for (const session of unclosedSessions) {
      try {
        // Ambil jadwal seharusnya dari assignment guru
        const [assignment] = await db.select().from(teacherInstitutionAssignments).where(eq(teacherInstitutionAssignments.id, session.assignmentId));
        
        if (!assignment || !assignment.weeklySchedule) {
          console.warn(`Assignment tidak ditemukan atau tidak memiliki jadwal untuk sesi ${session.id}`);
          continue;
        }

        // Parsing jadwal untuk menentukan durasi seharusnya
        // Dalam implementasi nyata, ini akan memeriksa jadwal harian sesuai hari dan jam
        const schedule = parseWeeklySchedule(assignment.weeklySchedule, session.timestamp);
        
        if (!schedule) {
          console.warn(`Jadwal tidak ditemukan untuk sesi ${session.id} pada tanggal ${session.timestamp}`);
          continue;
        }

        // Hitung apakah waktu sekarang sudah melewati batas waktu seharusnya ditambah toleransi
        const scheduledEndTime = new Date(session.timestamp);
        scheduledEndTime.setHours(schedule.endHour, schedule.endMinute, 0, 0);
        
        // Tambahkan 15 menit toleransi sebelum menutup otomatis
        const autoCloseTime = new Date(scheduledEndTime.getTime() + 15 * 60 * 1000); // 15 menit setelah selesai seharusnya
        const now = new Date();

        if (now > autoCloseTime) {
          // Sesi melewati batas waktu, tutup otomatis
          console.log(`Menutup otomatis sesi ${session.id} karena melewati batas waktu`);

          // Dapatkan informasi institusi untuk validasi lokasi
          const [institution] = await db.select().from(institutionsTable).where(eq(institutionsTable.id, session.institutionId));
          
          if (!institution) {
            console.error(`Institusi tidak ditemukan untuk sesi ${session.id}`);
            continue;
          }

          // Hitung durasi sebenarnya
          const actualDuration = differenceInMinutes(now, session.timestamp);

          // Buat log penutupan otomatis
          const [closeLog] = await db.insert(attendanceLogs).values({
            id: uuidv4(),
            teacherId: session.teacherId,
            institutionId: session.institutionId,
            assignmentId: session.assignmentId,
            type: 'mengajar_selesai',
            classSessionId: session.id, // Tautkan ke sesi yang dibuka
            subjectId: session.subjectId,
            timestamp: now,
            latitude: session.latitude,
            longitude: session.longitude,
            accuracy: 0, // Tidak ada data akurasi untuk sesi otomatis
            ipAddress: 'auto-close-cron',
            distanceFromInstitution: 0, // Tidak dihitung untuk sesi otomatis
            faceMatchScore: 0, // Tidak relevan untuk sesi otomatis
            livenessPassed: false, // Tidak relevan untuk sesi otomatis
            qrCodeVerified: null,
            browserFingerprint: 'auto-close-cron',
            trustScore: 0.5, // Skor tengah untuk sesi otomatis
            status: 'valid', // Status valid untuk sesi otomatis
            flagReasons: ['auto_closed_by_cron'], // Tandai bahwa ini ditutup otomatis
          }).returning();

          // Update log sesi mulai untuk menandai bahwa sesi telah ditutup
          await db.update(attendanceLogs)
            .set({
              classSessionId: closeLog.id, // Gunakan ID log selesai sebagai penanda bahwa sesi telah ditutup
            })
            .where(eq(attendanceLogs.id, session.id));

          // Update summary harian dengan durasi sesi
          await updateDailyAttendanceSummary(
            session.teacherId, 
            session.institutionId, 
            session.subjectId,
            actualDuration
          );

          console.log(`Sesi ${session.id} berhasil ditutup otomatis`);
        }
      } catch (sessionError) {
        console.error(`Error memproses sesi ${session.id}:`, sessionError);
      }
    }

    console.log('Proses auto-close selesai', new Date());
  } catch (error) {
    console.error('Error dalam proses auto-close sesi mengajar:', error);
    throw error;
  }
}

/**
 * Fungsi helper untuk parsing jadwal mingguan
 * Dalam implementasi nyata, ini akan lebih kompleks tergantung struktur weeklySchedule
 */
function parseWeeklySchedule(weeklySchedule: any, sessionDate: Date): { startHour: number; startMinute: number; endHour: number; endMinute: number } | null {
  // Ini adalah contoh sederhana - dalam implementasi nyata, struktur weeklySchedule
  // mungkin berbeda dan perlu diparsing sesuai dengan format yang digunakan
  try {
    const scheduleObj = typeof weeklySchedule === 'string' ? JSON.parse(weeklySchedule) : weeklySchedule;
    
    // Ambil hari dari tanggal sesi
    const dayIndex = sessionDate.getDay(); // 0 = Minggu, 1 = Senin, dst
    const dayNames = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    const dayName = dayNames[dayIndex];
    
    if (scheduleObj[dayName] && scheduleObj[dayName].length > 0) {
      // Ambil slot pertama dari hari tersebut sebagai contoh
      const slot = scheduleObj[dayName][0];
      if (slot.startTime && slot.endTime) {
        const [startHour, startMinute] = slot.startTime.split(':').map(Number);
        const [endHour, endMinute] = slot.endTime.split(':').map(Number);
        
        return { startHour, startMinute, endHour, endMinute };
      }
    }
    
    return null;
  } catch (parseError) {
    console.error('Error parsing weekly schedule:', parseError);
    return null;
  }
}

// Fungsi untuk update summary harian
async function updateDailyAttendanceSummary(
  teacherId: string, 
  institutionId: string, 
  subjectId: string, 
  durationInMinutes: number
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set ke awal hari
  
  // Cek apakah sudah ada summary untuk hari ini
  const [existingSummary] = await db.select()
    .from(attendanceSummary)
    .where(and(
      eq(attendanceSummary.teacherId, teacherId),
      eq(attendanceSummary.institutionId, institutionId),
      eq(attendanceSummary.date, today)
    ));

  if (existingSummary) {
    // Update summary yang ada dengan informasi sesi mengajar
    const currentTeachingMinutesBySubject = existingSummary.teachingMinutesBySubject 
      ? JSON.parse(existingSummary.teachingMinutesBySubject as string) 
      : {};
    
    const updatedTeachingMinutesBySubject = {
      ...currentTeachingMinutesBySubject,
      [subjectId]: (currentTeachingMinutesBySubject[subjectId] || 0) + durationInMinutes
    };
    
    await db.update(attendanceSummary)
      .set({
        teachingSessionsCompleted: existingSummary.teachingSessionsCompleted + 1,
        teachingMinutesTotal: existingSummary.teachingMinutesTotal + durationInMinutes,
        teachingMinutesBySubject: JSON.stringify(updatedTeachingMinutesBySubject),
        updatedAt: new Date(),
      })
      .where(eq(attendanceSummary.id, existingSummary.id));
  } else {
    // Buat summary baru
    const teachingMinutesBySubject = { [subjectId]: durationInMinutes };
    
    await db.insert(attendanceSummary).values({
      id: uuidv4(),
      teacherId,
      institutionId,
      date: today,
      teachingSessionsCompleted: 1,
      teachingMinutesTotal: durationInMinutes,
      teachingMinutesBySubject: JSON.stringify(teachingMinutesBySubject),
      attendanceStatus: 'hadir', // Asumsikan hadir dulu
    });
  }
}

// Jika file ini dijalankan langsung, eksekusi fungsi
if (require.main === module) {
  autoCloseTeachingSessions()
    .catch(error => {
      console.error('Error menjalankan autoCloseTeachingSessions:', error);
      process.exit(1);
    });
}