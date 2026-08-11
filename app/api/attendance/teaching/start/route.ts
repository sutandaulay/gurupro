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
import { subMinutes } from 'date-fns';

// Schema untuk validasi input
const StartTeachingSchema = z.object({
  sessionId: z.string().min(1, 'Session ID diperlukan'),
  institutionId: z.string().optional(),
  schoolId: z.string().uuid().optional(),
  subjectId: z.string().min(1, 'Subject ID diperlukan'),
  classSessionId: z.string().optional(),
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

    // Validasi tambahan: pastikan assignment aktif dan sesuai institusi atau sekolah
    const parsedInstId = validatedData.institutionId && /^\d+$/.test(validatedData.institutionId) 
      ? parseInt(validatedData.institutionId, 10) 
      : 0;
    
    let institutionIdNum = parsedInstId;
    let schoolId = validatedData.schoolId;
    let institutionLocation: { latitude: number; longitude: number } = { latitude: -6.2088, longitude: 106.8456 };
    let attendanceSettings: any = { classSessionRadiusMeters: 150 };
    let assignment: { id: string; teacherId: string; institutionId: number } | null = null;

    if (schoolId) {
      // Mode sekolah mandiri
      const schoolResult = await query(`
        SELECT id, nama_sekolah, location_latitude, location_longitude, attendance_radius_meters
        FROM schools
        WHERE id = $1 AND user_id = $2
      `, [schoolId, userId]);

      if (schoolResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sekolah tidak ditemukan atau bukan milik Anda' }, { status: 404 });
      }

      const school = schoolResult.rows[0];
      institutionLocation = {
        latitude: school.location_latitude ? parseFloat(school.location_latitude) : -6.2088,
        longitude: school.location_longitude ? parseFloat(school.location_longitude) : 106.8456,
      };
      attendanceSettings = {
        classSessionRadiusMeters: school.attendance_radius_meters || 150,
      };
      institutionIdNum = parseInt(school.id, 10);
      assignment = {
        id: uuidv4(),
        teacherId: userId,
        institutionId: institutionIdNum,
      };
    } else if (parsedInstId > 0) {
      // Mode institusi terinstansi — cari membership di payload.institution_members
      const memberResult = await query(`
        SELECT 
          im.id,
          im.institution_id as "institutionId"
        FROM public.institution_members im
        LEFT JOIN payload.institution_members_role imr ON imr.parent_id = im.id
        WHERE im.app_user_id = $1 
          AND im.institution_id = $2
          AND im.status = 'active'
        LIMIT 1
      `, [userId, parsedInstId]);

      const memberRow = memberResult.rows[0];
      if (!memberRow) {
        return NextResponse.json({ error: 'Anda tidak terdaftar sebagai anggota institusi ini' }, { status: 404 });
      }

      assignment = {
        id: uuidv4(),
        teacherId: userId,
        institutionId: parseInt(memberRow.institutionId, 10),
      };

      // Dapatkan setting institusi
      const instResult = await query(`
        SELECT 
          id,
          name,
          location_latitude as "locationLatitude",
          location_longitude as "locationLongitude",
          attendance_settings_class_session_radius_meters as "classSessionRadiusMeters"
        FROM payload.institutions
        WHERE id = $1
      `, [parsedInstId]);

      if (instResult.rows.length === 0) {
        return NextResponse.json({ error: 'Institusi tidak ditemukan' }, { status: 404 });
      }

      const rawInstitution = instResult.rows[0];
      institutionLocation = {
        latitude: rawInstitution.locationLatitude ? parseFloat(rawInstitution.locationLatitude) : -6.2088,
        longitude: rawInstitution.locationLongitude ? parseFloat(rawInstitution.locationLongitude) : 106.8456,
      };
      attendanceSettings = {
        classSessionRadiusMeters: rawInstitution.classSessionRadiusMeters || 150,
      };
    } else {
      return NextResponse.json({ error: 'institutionId atau schoolId wajib diisi' }, { status: 400 });
    }

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment tidak valid' }, { status: 400 });
    }
    
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

    // Check if there's an open session (no matching end log exists)
    const endLogs = await db.select({ classSessionId: attendanceLogs.classSessionId })
      .from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.teacherId, userId),
        eq(attendanceLogs.type, 'mengajar_selesai'),
        eq(attendanceLogs.subjectId, validatedData.subjectId)
      ));

    const closedSessionIds = new Set(endLogs.map(log => log.classSessionId));

    const openSession = activeSessions.find(session => {
      return !session.classSessionId || !closedSessionIds.has(session.classSessionId);
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
      institutionId: assignment.institutionId,
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
      assignment.institutionId, 
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
async function updateDailyAttendanceSummary(teacherId: string, institutionId: number, subjectId: string) {
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
      ? (typeof existingSummary.teachingMinutesBySubject === 'string'
        ? JSON.parse(existingSummary.teachingMinutesBySubject)
        : existingSummary.teachingMinutesBySubject)
      : {};
    const updatedTeachingMinutesBySubject = { ...currentTeachingMinutesBySubject, [subjectId]: 0 };
    
    await db.update(attendanceSummary)
      .set({
        teachingSessionsCompleted: (existingSummary.teachingSessionsCompleted || 0) + 1,
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