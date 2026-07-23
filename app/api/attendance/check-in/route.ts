import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { db, query } from '@/lib/db';
import {
  attendanceLogs,
  attendanceSummary,
  attendanceDevices,
  institutions as institutionsTable,
  formatInstitution
} from '@/lib/schemas/attendance';
import { eq, and, desc, lt, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { subMinutes } from 'date-fns';

// Schema untuk validasi input
const CheckInSchema = z.object({
  faceEmbedding: z.string().min(1, 'Face embedding diperlukan'),
  faceMatchScore: z.number().min(0).max(1, 'Face match score harus antara 0 dan 1'),
  livenessPassed: z.boolean(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
  institutionId: z.string().optional(),
  schoolId: z.string().optional(),
  assignmentId: z.string().uuid().optional(),
  qrCodeVerified: z.boolean().optional(),
  browserFingerprint: z.string().optional(),
  teacherId: z.string(),
  type: z.string(),
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

    // Parse dan validasi request body
    const body = await req.json();
    const validatedData = CheckInSchema.parse({
      ...body,
      teacherId: session.id,
      type: 'masuk' as const,
    });

    // Dapatkan IP address dari request
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    const { institutionId, schoolId, latitude, longitude } = validatedData;
    let institutionIdNum: number | null = null;
    let institutionLocation: { latitude: number; longitude: number } | null = null;
    let attendanceSettings: any = null;
    let distance = 0;
    let refId = validatedData.assignmentId || `school-${schoolId}`;

    // ==========================================
    // Handle sekolah mandiri (schoolId)
    // ==========================================
    if (schoolId) {
      const schoolResult = await query(`
        SELECT id, nama_sekolah, location_latitude, location_longitude, attendance_radius_meters
        FROM schools
        WHERE id = $1 AND user_id = $2
      `, [schoolId, session.id]);

      if (schoolResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sekolah tidak ditemukan atau bukan milik Anda' }, { status: 404 });
      }

      const school = schoolResult.rows[0];
      const currentLat = typeof latitude === 'number' ? latitude : parseFloat(String(latitude));
      const currentLng = typeof longitude === 'number' ? longitude : parseFloat(String(longitude));

      // Jika sekolah belum punya koordinat, simpan GPS saat ini sebagai referensi
      if (!school.location_latitude || !school.location_longitude) {
        await query(
          `UPDATE schools 
           SET location_latitude = $1, location_longitude = $2, attendance_radius_meters = COALESCE(attendance_radius_meters, 100) 
           WHERE id = $3`,
          [currentLat, currentLng, schoolId]
        );

        institutionLocation = { latitude: currentLat, longitude: currentLng };
        attendanceSettings = {
          attendanceRadiusMeters: school.attendance_radius_meters || 100,
          duplicateCheckMinutes: 5,
          qrCodeEnabled: false,
        };
        distance = 0;
        refId = validatedData.assignmentId || schoolId;
      } else {
        institutionLocation = {
          latitude: parseFloat(school.location_latitude),
          longitude: parseFloat(school.location_longitude),
        };
        attendanceSettings = {
          attendanceRadiusMeters: school.attendance_radius_meters || 100,
          duplicateCheckMinutes: 5,
          qrCodeEnabled: false,
        };
        distance = calculateDistance(latitude, longitude, institutionLocation.latitude, institutionLocation.longitude);
        refId = validatedData.assignmentId || schoolId;
      }

      institutionIdNum = parseInt(school.id, 10);
    } 
    // ==========================================
    // Handle institusi terinstansi (institutionId)
    // ==========================================
    else if (institutionId) {
      institutionIdNum = parseInt(institutionId, 10);

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
      `, [institutionIdNum]);

      if (instResult.rows.length === 0) {
        return NextResponse.json({ error: 'Institusi tidak ditemukan' }, { status: 404 });
      }

      const rawInstitution = instResult.rows[0];
      const institution = formatInstitution(rawInstitution)!;
      institutionLocation = institution.location;
      attendanceSettings = institution.attendanceSettings;

      distance = calculateDistance(
        latitude,
        longitude,
        institutionLocation.latitude,
        institutionLocation.longitude
      );
      refId = validatedData.assignmentId || institutionId;
    } else {
      return NextResponse.json({ error: 'institutionId atau schoolId wajib diisi' }, { status: 400 });
    }

    if (!institutionLocation || !institutionIdNum) {
      return NextResponse.json({ error: 'Lokasi institusi tidak ditemukan' }, { status: 400 });
    }

    // ==========================================
    // Validasi rate limiting & anti-fraud
    // ==========================================
    if (!institutionLocation) {
      return NextResponse.json({ error: 'Lokasi institusi tidak ditemukan' }, { status: 400 });
    }

    const duplicateCheckMinutes = attendanceSettings.duplicateCheckMinutes || 5;
    const minTime = subMinutes(new Date(), duplicateCheckMinutes);

    const recentLogs = await db.select()
      .from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.teacherId, validatedData.teacherId),
        eq(attendanceLogs.institutionId, institutionIdNum as number),
        eq(attendanceLogs.type, 'masuk'),
        lt(attendanceLogs.timestamp, new Date()),
        gt(attendanceLogs.timestamp, minTime)
      ));

    if (recentLogs.length > 0) {
      return NextResponse.json({
        error: 'Presensi terlalu cepat, tunggu sebentar sebelum mencoba lagi',
      }, { status: 429 });
    }

    const { trustScore, flagReasons } = await performAntiFraudChecks(
      validatedData,
      ipAddress,
      String(institutionIdNum),
      distance,
      attendanceSettings
    );

    // Tentukan status berdasarkan skor kepercayaan
    let status: 'valid' | 'flagged' | 'rejected' = 'valid';
    const trustThreshold = 0.6;
    if (trustScore < trustThreshold) {
      status = 'flagged';
    }

    // Buat record log presensi
    const attendanceLog = await db.insert(attendanceLogs).values({
      id: uuidv4(),
      teacherId: validatedData.teacherId,
      institutionId: institutionIdNum as number,
      assignmentId: validatedData.assignmentId || '',
      type: validatedData.type,
      timestamp: new Date(),
      latitude: validatedData.latitude,
      longitude: validatedData.longitude,
      accuracy: validatedData.accuracy,
      ipAddress: ipAddress,
      distanceFromInstitution: distance,
      faceMatchScore: validatedData.faceMatchScore,
      livenessPassed: validatedData.livenessPassed,
      qrCodeVerified: validatedData.qrCodeVerified || null,
      browserFingerprint: validatedData.browserFingerprint || '',
      trustScore: trustScore,
      status: status,
      flagReasons: flagReasons.length > 0 ? flagReasons : null,
    }).returning();

    // Update atau buat summary harian
    await updateDailyAttendanceSummary(validatedData.teacherId, institutionIdNum);

    return NextResponse.json({
      success: true,
      message: schoolId ? 'Presensi sekolah berhasil dicatat' : 'Presensi masuk berhasil dicatat',
      refId: refId,
      distanceFromInstitution: distance,
      faceMatchScore: validatedData.faceMatchScore,
      trustScore: trustScore,
      status: status,
      ...(flagReasons.length > 0 && { flagReasons })
    });
  } catch (error) {
    console.error('Check-in error:', error);
    
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

// Fungsi helper untuk mendapatkan lokasi dari IP
async function getIPLocation(ipAddress: string) {
  // Dalam implementasi nyata, ini akan panggil service geolocation berdasarkan IP
  // Untuk simulasi, kita kembalikan null
  return null;
}


// Fungsi untuk update summary harian
async function updateDailyAttendanceSummary(teacherId: string, institutionId: number) {
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
    // Update summary yang ada
    await db.update(attendanceSummary)
      .set({
        checkInTime: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(attendanceSummary.id, existingSummary.id));
  } else {
    // Buat summary baru
    await db.insert(attendanceSummary).values({
      id: uuidv4(),
      teacherId,
      institutionId,
      date: today,
      checkInTime: new Date(),
      attendanceStatus: 'hadir', // Asumsikan hadir dulu, nanti bisa diupdate
    });
  }
}

// Fungsi untuk melakukan semua validasi anti-fraud
async function performAntiFraudChecks(
  validatedData: z.infer<typeof CheckInSchema>,
  ipAddress: string,
  institutionId: string,
  distance: number,
  attendanceSettings: any
): Promise<{ trustScore: number, flagReasons: string[] }> {
  let trustScore = 1.0; // Skor awal
  const flagReasons: string[] = [];

  // 1. Validasi radius - penalty lebih besar jika terlalu jauh
  const radius = attendanceSettings.attendanceRadiusMeters || 100;
  if (distance > radius * 2) {
    trustScore -= 0.5; // Lebih dari 2x radius
    flagReasons.push('outside_radius_critical');
  } else if (distance > radius) {
    trustScore -= 0.3; // Sedikit di luar radius
    flagReasons.push('outside_radius');
  }

  // 2. Validasi akurasi GPS - penalty jika akurasi terlalu rendah
  if (validatedData.accuracy > 100) {
    trustScore -= 0.3;
    flagReasons.push('very_low_accuracy');
  } else if (validatedData.accuracy > 50) {
    trustScore -= 0.2;
    flagReasons.push('low_accuracy');
  }

  // 3. Validasi liveness - sangat penting untuk anti-spoofing
  if (!validatedData.livenessPassed) {
    trustScore -= 0.4;
    flagReasons.push('liveness_failed');
  }

  // 4. Validasi face match score
  if (validatedData.faceMatchScore < 0.5) {
    trustScore -= 0.3;
    flagReasons.push('low_face_match');
  } else if (validatedData.faceMatchScore < 0.7) {
    trustScore -= 0.15;
    flagReasons.push('medium_face_match');
  }

  // 5. Browser fingerprint check
  if (validatedData.browserFingerprint) {
    const fingerprintResult = await checkBrowserFingerprintMismatch(
      validatedData.teacherId,
      validatedData.browserFingerprint
    );
    if (fingerprintResult.isNewDevice) {
      trustScore -= 0.1; // Penalty untuk device baru, tapi tidak blocking
      flagReasons.push('new_device_registered');
    }
    if (fingerprintResult.isMismatch) {
      trustScore -= 0.15;
      flagReasons.push('fingerprint_mismatch');
    }
  }

  // 6. Speed sanity check - deteksi teleportation (hanya check-out yang bermakna, skip untuk check-in pertama)
  // Untuk check-in, kita tidak проверяем speed karena belum ada data sebelumnya

  // 7. Deteksi anomali accuracy - cek konsistensi GPS
  const accuracyResult = await checkAccuracyAnomaly(validatedData.teacherId, validatedData.accuracy);
  if (accuracyResult.isAnomaly) {
    trustScore -= 0.1;
    flagReasons.push('accuracy_anomaly');
  }

  // 8. Deteksi koordinat statis - cek apakah koordinat selalu sama
  const staticResult = await checkStaticCoordinates(validatedData.teacherId, validatedData.latitude, validatedData.longitude);
  if (staticResult.isStatic) {
    trustScore -= 0.1;
    flagReasons.push('static_coordinates');
  }

  // 9. Validasi QR Code (jika diaktifkan) - QR memberikan bonus kepercayaan
  const qrCodeEnabled = attendanceSettings.qrCodeEnabled;
  if (qrCodeEnabled) {
    if (!validatedData.qrCodeVerified) {
      trustScore -= 0.1;
      flagReasons.push('qr_code_required_not_verified');
    } else {
      // QR Code verified gives bonus to trust score
      trustScore += 0.15;
    }
  }

  // Pastikan skor tidak kurang dari 0
  trustScore = Math.max(0, Math.min(1, trustScore));

  return { trustScore, flagReasons };
}

// Fungsi helper untuk validasi browser fingerprint
async function checkBrowserFingerprintMismatch(
  teacherId: string,
  currentFingerprint: string
): Promise<{ isMismatch: boolean; isNewDevice: boolean }> {
  try {
    // Ambil fingerprint sebelumnya dari database
    const devices = await db.select()
      .from(attendanceDevices)
      .where(and(
        eq(attendanceDevices.teacherId, teacherId),
        eq(attendanceDevices.isActive, true)
      ));

    // Jika tidak ada device terdaftar, ini perangkat baru
    if (devices.length === 0) {
      // Tambahkan perangkat baru ke database
      await db.insert(attendanceDevices).values({
        id: uuidv4(),
        teacherId,
        browserFingerprint: currentFingerprint,
        registeredAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      });
      return { isMismatch: false, isNewDevice: true };
    }

    // Cek apakah fingerprint saat ini cocok dengan salah satu yang terdaftar
    const matchedDevice = devices.find(device => device.browserFingerprint === currentFingerprint);

    if (matchedDevice) {
      // Update last seen untuk fingerprint ini
      await db.update(attendanceDevices)
        .set({ lastSeenAt: new Date() })
        .where(eq(attendanceDevices.id, matchedDevice.id));
      return { isMismatch: false, isNewDevice: false };
    } else {
      // Fingerprint baru, tapi tetap daftarkan
      await db.insert(attendanceDevices).values({
        id: uuidv4(),
        teacherId,
        browserFingerprint: currentFingerprint,
        registeredAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      });
      return { isMismatch: true, isNewDevice: true };
    }
  } catch (error) {
    console.error('Error checking fingerprint:', error);
    return { isMismatch: false, isNewDevice: false };
  }
}

// Fungsi helper untuk deteksi anomali accuracy
async function checkAccuracyAnomaly(
  teacherId: string,
  currentAccuracy: number
): Promise<{ isAnomaly: boolean; stdDev?: number }> {
  try {
    // Ambil beberapa presensi terakhir untuk analisis
    const recentLogs = await db.select({ accuracy: attendanceLogs.accuracy })
      .from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.teacherId, teacherId),
        eq(attendanceLogs.status, 'valid')
      ))
      .orderBy(desc(attendanceLogs.timestamp))
      .limit(10);

    if (recentLogs.length < 3) {
      return { isAnomaly: false }; // Tidak cukup data
    }

    const accuracies = recentLogs.map(log => log.accuracy || 0);

    // Jika semua accuracy persis sama, ini mencurigakan (fake GPS)
    const uniqueAccuracies = new Set(accuracies);
    if (uniqueAccuracies.size === 1 && currentAccuracy === accuracies[0]) {
      return { isAnomaly: true, stdDev: 0 };
    }

    // Hitung standar deviasi
    const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const squaredDiffs = accuracies.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / accuracies.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Jika standar deviasi sangat rendah (< 1m) dan ada lebih dari 5 data, tandai
    if (stdDev < 1 && accuracies.length > 5) {
      return { isAnomaly: true, stdDev };
    }

    // Jika akurasi = 0, ini jelas anomali
    if (currentAccuracy === 0) {
      return { isAnomaly: true, stdDev };
    }

    return { isAnomaly: false, stdDev: Math.round(stdDev * 10) / 10 };
  } catch (error) {
    console.error('Accuracy anomaly check error:', error);
    return { isAnomaly: false };
  }
}

// Fungsi helper untuk deteksi koordinat statis
async function checkStaticCoordinates(
  teacherId: string,
  lat: number,
  lng: number
): Promise<{ isStatic: boolean; matchPercentage?: number }> {
  try {
    // Ambil beberapa presensi terakhir
    const recentLogs = await db.select({
      latitude: attendanceLogs.latitude,
      longitude: attendanceLogs.longitude
    })
      .from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.teacherId, teacherId),
        eq(attendanceLogs.status, 'valid')
      ))
      .orderBy(desc(attendanceLogs.timestamp))
      .limit(20);

    if (recentLogs.length < 5) {
      return { isStatic: false }; // Tidak cukup data
    }

    // Cek apakah koordinat ini sama persis dengan beberapa presensi sebelumnya
    const tolerance = 0.00001; // Sekitar 1 meter
    const matchingCoords = recentLogs.filter(log =>
      Math.abs((log.latitude || 0) - lat) < tolerance &&
      Math.abs((log.longitude || 0) - lng) < tolerance
    );

    const matchPercentage = (matchingCoords.length / recentLogs.length) * 100;

    // Jika lebih dari 40% dari presensi sebelumnya memiliki koordinat yang sama, tandai
    return {
      isStatic: matchPercentage > 40,
      matchPercentage: Math.round(matchPercentage)
    };
  } catch (error) {
    console.error('Static coordinates check error:', error);
    return { isStatic: false };
  }
}