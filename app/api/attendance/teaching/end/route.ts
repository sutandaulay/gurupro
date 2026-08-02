import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { db, query } from '@/lib/db';
import { 
  attendanceLogs, 
  attendanceSummary,
} from '@/lib/schemas/attendance';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { differenceInMinutes } from 'date-fns';

// Schema untuk validasi input
const EndTeachingSchema = z.object({
  sessionId: z.string().min(1, 'Session ID diperlukan'), // Accept any non-empty string
  classSessionId: z.string().optional(), // The class session ID to match
  subjectId: z.string().optional(),
  subjectName: z.string().optional(),
  faceEmbedding: z.string().optional(),
  faceMatchScore: z.number().min(0).max(1).optional(),
  livenessPassed: z.boolean().optional(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().min(0),
  institutionId: z.string().optional(),
  assignmentId: z.string().uuid().optional(),
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
    const validatedData = EndTeachingSchema.parse(body);

    // Dapatkan IP address dari request
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    // Cari log sesi mengajar yang belum ditutup
    // Try to find by sessionId or classSessionId
    let startLog = null;

    const queryConditions = [
      eq(attendanceLogs.teacherId, userId),
      eq(attendanceLogs.type, 'mengajar_mulai'),
    ];

    if (validatedData.sessionId) {
      queryConditions.push(eq(attendanceLogs.id, validatedData.sessionId));
    }

    if (validatedData.classSessionId) {
      queryConditions.push(eq(attendanceLogs.classSessionId, validatedData.classSessionId));
    }

    const possibleLogs = await db.select({
      id: attendanceLogs.id,
      teacherId: attendanceLogs.teacherId,
      institutionId: attendanceLogs.institutionId,
      assignmentId: attendanceLogs.assignmentId,
      subjectId: attendanceLogs.subjectId,
      timestamp: attendanceLogs.timestamp,
      latitude: attendanceLogs.latitude,
      longitude: attendanceLogs.longitude,
      accuracy: attendanceLogs.accuracy,
      classSessionId: attendanceLogs.classSessionId,
    })
      .from(attendanceLogs)
      .where(and(...queryConditions))
      .limit(10);

    // Filter to find an open session (no matching end log exists)
    let endLogsForMatch: any[] = [];
    try {
      endLogsForMatch = await db.select({ classSessionId: attendanceLogs.classSessionId })
        .from(attendanceLogs)
        .where(and(
          eq(attendanceLogs.teacherId, userId),
          eq(attendanceLogs.type, 'mengajar_selesai')
        ));
    } catch {}
    const closedSessionIds = new Set(endLogsForMatch.map(log => log.classSessionId));
    startLog = possibleLogs.find(log => {
      return !log.classSessionId || !closedSessionIds.has(log.classSessionId);
    });

    // Fallback to first log if none found open
    if (!startLog && possibleLogs.length > 0) {
      startLog = possibleLogs[0];
    }

    if (!startLog) {
      return NextResponse.json({ error: 'Sesi mengajar tidak ditemukan atau sudah ditutup' }, { status: 404 });
    }

    // Dapatkan setting institusi
    const parsedInstId = startLog.institutionId; // Already a number/integer in the database log row
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

    const institutionLocation = {
      latitude: rawInstitution.locationLatitude ? parseFloat(rawInstitution.locationLatitude) : -6.2088,
      longitude: rawInstitution.locationLongitude ? parseFloat(rawInstitution.locationLongitude) : 106.8456,
    };

    const attendanceSettings = {
      attendanceRadiusMeters: rawInstitution.attendanceRadiusMeters ? parseFloat(rawInstitution.attendanceRadiusMeters) : 100,
      classSessionRadiusMeters: rawInstitution.classSessionRadiusMeters ? parseFloat(rawInstitution.classSessionRadiusMeters) : 150,
      lateToleranceMinutes: rawInstitution.lateToleranceMinutes ?? 15,
      duplicateCheckMinutes: rawInstitution.duplicateCheckMinutes ?? 5,
      qrCodeEnabled: !!rawInstitution.qrCodeEnabled,
      qrCodeToken: rawInstitution.qrCodeToken ?? null,
    };
    
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
        error: 'Anda berada di luar radius institusi untuk menutup sesi mengajar',
        distance: distance,
        radius: radius
      }, { status: 400 });
    }

    // Hitung durasi sesi
    const startTime = startLog.timestamp;
    const endTime = new Date();
    const durationInMinutes = differenceInMinutes(endTime, startTime);

    // Jalankan validasi anti-fraud (menggunakan fungsi dari check-in)
    const { trustScore, flagReasons } = await performAntiFraudChecks(
      validatedData,
      ipAddress,
      startLog.institutionId,
      distance,
      attendanceSettings
    );

    // Tentukan status berdasarkan skor kepercayaan
    let status: 'valid' | 'flagged' | 'rejected' = 'valid';
    const trustThreshold = 0.6; // Konfigurabel
    if (trustScore < trustThreshold) {
      status = 'flagged';
    }

    // Buat record log presensi mengajar selesai
    const endLogId = uuidv4();
    const [attendanceLog] = await db.insert(attendanceLogs).values({
      id: endLogId,
      teacherId: userId,
      institutionId: startLog.institutionId,
      assignmentId: startLog.assignmentId,
      type: 'mengajar_selesai',
      classSessionId: startLog.classSessionId,
      subjectId: validatedData.subjectId || startLog.subjectId,
      timestamp: endTime,
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

    // Update summary harian dengan durasi sesi
    await updateDailyAttendanceSummary(
      userId,
      startLog.institutionId,
      validatedData.subjectId || startLog.subjectId || '',
      durationInMinutes
    );

    return NextResponse.json({
      success: true,
      message: 'Sesi mengajar berhasil ditutup',
      sessionId: attendanceLog.id,
      durationInMinutes: durationInMinutes,
      distanceFromInstitution: distance,
      trustScore: trustScore,
      status: status,
      ...(flagReasons.length > 0 && { flagReasons })
    });
  } catch (error) {
    console.error('End teaching session error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validasi input gagal', 
          details: error.issues 
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
  institutionId: number,
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
async function updateDailyAttendanceSummary(
  teacherId: string, 
  institutionId: number, 
  subjectId: string, 
  durationInMinutes: number = 0
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set ke awal hari
  
  // Cek apakah sudah ada summary untuk hari ini
  const [existingSummary] = await db.select()
    .from(attendanceSummary)
    .where(and(
      eq(attendanceSummary.teacherId, teacherId),
      eq(attendanceSummary.institutionId, Number(institutionId)) as any,
      eq(attendanceSummary.date, today)
    ));

  if (existingSummary) {
    // Update summary yang ada dengan informasi sesi mengajar
    const currentTeachingMinutesBySubject = existingSummary.teachingMinutesBySubject 
      ? (typeof existingSummary.teachingMinutesBySubject === 'string'
        ? JSON.parse(existingSummary.teachingMinutesBySubject)
        : existingSummary.teachingMinutesBySubject)
      : {};
    
    const updatedTeachingMinutesBySubject = {
      ...currentTeachingMinutesBySubject,
      [subjectId]: (currentTeachingMinutesBySubject[subjectId] || 0) + durationInMinutes
    };
    
    await db.update(attendanceSummary)
      .set({
        teachingSessionsCompleted: (existingSummary.teachingSessionsCompleted || 0) + 1,
        teachingMinutesTotal: (existingSummary.teachingMinutesTotal || 0) + durationInMinutes,
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
      institutionId: Number(institutionId) as any,
      date: today,
      teachingSessionsCompleted: 1,
      teachingMinutesTotal: durationInMinutes,
      teachingMinutesBySubject: JSON.stringify(teachingMinutesBySubject),
      attendanceStatus: 'hadir', // Asumsikan hadir dulu
    });
  }
}