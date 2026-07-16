import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { db, query } from '@/lib/db';
import { 
  attendanceLogs, 
  attendanceSummary,
  institutions as institutionsTable,
  teacherInstitutionAssignments,
  formatInstitution
} from '@/lib/schemas/attendance';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { subMinutes } from 'date-fns';

// Schema untuk validasi input
const StartTeachingSchema = z.object({
  sessionId: z.string().min(1, 'Session ID diperlukan'), // Accept any non-empty string
  institutionId: z.string(),
  subjectId: z.string().min(1, 'Subject ID diperlukan'),
  classSessionId: z.string().optional(), // Optional - can be same as sessionId
  subjectName: z.string().optional(),
  faceEmbedding: z.string().optional(),
  faceMatchScore: z.number().min(0).max(1).optional(),
  livenessPassed: z.boolean().optional(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().min(0),
  browserFingerprint: z.string().optional(),
  qrCodeVerified: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    // Validasi sesi pengguna
    let session;
    try {
      session = await requireSession();
    } catch (err) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id;

    // Parse dan validasi request body
    const body = await req.json();
    const validatedData = StartTeachingSchema.parse(body);

    // Dapatkan IP address dari request
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    // Validasi tambahan: pastikan assignment aktif dan sesuai institusi
    const parsedInstId = /^\d+$/.test(validatedData.institutionId) ? parseInt(validatedData.institutionId, 10) : 0;
    const [assignment] = await db.select()
      .from(teacherInstitutionAssignments)
      .where(and(
        eq(teacherInstitutionAssignments.teacherId, userId),
        eq(teacherInstitutionAssignments.institutionId, parsedInstId),
        eq(teacherInstitutionAssignments.status, 'aktif')
      ));
    
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment tidak ditemukan atau tidak aktif' }, { status: 404 });
    }

    // Dapatkan setting institusi
    const instResult = await query(`
      SELECT 
        id,
        name,
        location_latitude as "locationLatitude",
        location_longitude as "locationLongitude",
        attendance_settings_attendance_radius_meters as "attendanceRadiusMeters",
        attendance_settings_class_session_radius_meters as "classSessionRadiusMeters",
        attendance_settings_late_tolerance_minutes as "lateToleranceMinutes",
        attendance_settings_duplicate_check_minutes as "duplicateCheckMinutes",
        attendance_settings_qr_code_enabled as "qrCodeEnabled",
        attendance_settings_qr_code_token as "qrCodeToken"
      FROM payload.institutions
      WHERE id = $1
    `, [parsedInstId]);

    if (instResult.rows.length === 0) {
      return NextResponse.json({ error: 'Institusi tidak ditemukan' }, { status: 404 });
    }

    const rawInstitution = instResult.rows[0];
    const institution = formatInstitution(rawInstitution)!;
    const institutionLocation = institution.location;
    const attendanceSettings = institution.attendanceSettings;
    
    const distance = calculateDistance(
      validatedData.latitude,
      validatedData.longitude,
      institutionLocation.latitude,
      institutionLocation.longitude
    );

    // Validasi radius sesi kelas (lebih longgar dari radius presensi masuk)
    const radius = attendanceSettings.classSessionRadiusMeters || 150;
    if (distance > radius) {
      return NextResponse.json({
        error: 'Anda berada di luar radius institusi untuk sesi mengajar',
        distance: distance,
        radius: radius
      }, { status: 400 });
    }

    // Validasi rate limiting - cek apakah sudah ada sesi mengajar aktif untuk subject yang sama
    const activeSessions = await db.select()
      .from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.teacherId, userId),
        eq(attendanceLogs.type, 'mengajar_mulai'),
        eq(attendanceLogs.subjectId, validatedData.subjectId)
      ));

    // Check if there's an open session (classSessionId not marked as closed)
    // We mark a session as closed by setting classSessionId to the end log ID
    const openSession = activeSessions.find(session => {
      // If classSessionId is not set or is different from expected closed format, it's open
      return !session.classSessionId || !session.classSessionId.startsWith('closed_');
    });

    if (openSession) {
      return NextResponse.json({
        error: 'Anda masih memiliki sesi mengajar yang aktif untuk mata pelajaran ini',
        activeSessionId: openSession.id,
      }, { status: 400 });
    }

    // Jalankan validasi anti-fraud (menggunakan fungsi dari check-in)
    const { trustScore, flagReasons } = await performAntiFraudChecks(
      validatedData,
      ipAddress,
      validatedData.institutionId,
      distance,
      attendanceSettings
    );

    // Tentukan status berdasarkan skor kepercayaan
    let status: 'valid' | 'flagged' | 'rejected' = 'valid';
    const trustThreshold = 0.6; // Konfigurabel
    if (trustScore < trustThreshold) {
      status = 'flagged';
    }

    // Buat record log presensi mengajar mulai
    const sessionUuid = validatedData.sessionId.includes('_') ? uuidv4() : validatedData.sessionId;

    const [attendanceLog] = await db.insert(attendanceLogs).values({
      id: sessionUuid,
      teacherId: userId,
      institutionId: validatedData.institutionId,
      assignmentId: assignment.id,
      type: 'mengajar_mulai',
      classSessionId: validatedData.classSessionId || validatedData.sessionId, // ID sesi kelas
      subjectId: validatedData.subjectId, // ID mata pelajaran
      timestamp: new Date(),
      latitude: validatedData.latitude,
      longitude: validatedData.longitude,
      accuracy: validatedData.accuracy,
      ipAddress: ipAddress,
      distanceFromInstitution: distance,
      faceMatchScore: validatedData.faceMatchScore ?? 0.8,
      livenessPassed: validatedData.livenessPassed ?? true,
      qrCodeVerified: validatedData.qrCodeVerified ?? null,
      browserFingerprint: validatedData.browserFingerprint || '',
      trustScore: trustScore,
      status: status,
      flagReasons: flagReasons.length > 0 ? flagReasons : null,
    }).returning();

    // Update atau buat summary harian
    await updateDailyAttendanceSummary(
      userId, 
      validatedData.institutionId, 
      validatedData.subjectId
    );

    return NextResponse.json({
      success: true,
      message: 'Sesi mengajar berhasil dimulai',
      sessionId: attendanceLog.id,
      distanceFromInstitution: distance,
      trustScore: trustScore,
      status: status,
      ...(flagReasons.length > 0 && { flagReasons })
    });
  } catch (error) {
    console.error('Start teaching session error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validasi input gagal', 
          details: error.errors 
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

// Fungsi untuk melakukan validasi anti-fraud (disesuaikan dari fungsi sebelumnya)
async function performAntiFraudChecks(
  validatedData: any,
  ipAddress: string,
  institutionId: string,
  distance: number,
  attendanceSettings: any
): Promise<{ trustScore: number, flagReasons: string[] }> {
  let trustScore = 1.0; // Skor awal
  const flagReasons: string[] = [];

  // 1. Validasi radius sesi kelas
  const radius = attendanceSettings.classSessionRadiusMeters || 150;
  if (distance > radius) {
    trustScore -= 0.3; // Kurangi skor
    flagReasons.push('outside_class_session_radius');
  }

  // 2. Validasi akurasi GPS
  if (validatedData.accuracy > 50) {
    trustScore -= 0.2;
    flagReasons.push('low_accuracy');
  }

  // 3. Browser fingerprint check (implementasi menyusul)
  // 4. Cross-check IP geolocation vs GPS geolocation (implementasi menyusul)
  // 5. Speed sanity check (implementasi menyusul)
  // 6. Deteksi anomali accuracy (implementasi menyusul)
  // 7. Deteksi koordinat statis (implementasi menyusul)

  // 8. Validasi QR Code (jika diaktifkan)
  const qrCodeEnabled = attendanceSettings.qrCodeEnabled;
  if (qrCodeEnabled && !validatedData.qrCodeToken) {
    trustScore -= 0.1;
    flagReasons.push('qr_code_required_not_verified');
  } else if (qrCodeEnabled && validatedData.qrCodeToken) {
    // QR Code verified gives bonus to trust score
    trustScore += 0.15;
    // Cap maksimal skor agar tidak lebih dari 1
    trustScore = Math.min(trustScore, 1.0);
  }

  return { trustScore, flagReasons };
}

// Fungsi untuk menghitung jarak antara dua titik (haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meter
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // meter
}

// Fungsi untuk update summary harian
async function updateDailyAttendanceSummary(teacherId: string, institutionId: string, subjectId: string) {
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
    const updatedTeachingMinutesBySubject = existingSummary.teachingMinutesBySubject 
      ? { ...JSON.parse(existingSummary.teachingMinutesBySubject as string), [subjectId]: 0 } 
      : { [subjectId]: 0 };
    
    await db.update(attendanceSummary)
      .set({
        teachingSessionsCompleted: existingSummary.teachingSessionsCompleted + 1,
        teachingMinutesBySubject: JSON.stringify(updatedTeachingMinutesBySubject),
        updatedAt: new Date(),
      })
      .where(eq(attendanceSummary.id, existingSummary.id));
  } else {
    // Buat summary baru
    const teachingMinutesBySubject = { [subjectId]: 0 };
    
    await db.insert(attendanceSummary).values({
      id: uuidv4(),
      teacherId,
      institutionId,
      date: today,
      teachingSessionsCompleted: 1,
      teachingMinutesBySubject: JSON.stringify(teachingMinutesBySubject),
      attendanceStatus: 'hadir', // Asumsikan hadir dulu
    });
  }
}