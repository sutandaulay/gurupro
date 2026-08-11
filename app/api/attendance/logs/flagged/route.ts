import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { db } from '@/lib/db';
import { parsePagination, paginationMeta, offset } from '@/lib/pagination';
import { attendanceLogs, institutions, schools } from '@/lib/schemas/attendance';
import { users } from '@/lib/schemas/main-schema';
import { eq, and, gte, lte, ilike, inArray, desc, sql, count } from 'drizzle-orm';

const FLAG_REASON_OPTIONS = [
  'outside_radius', 'low_accuracy', 'ip_gps_mismatch',
  'impossible_speed', 'accuracy_anomaly', 'liveness_failed',
  'face_mismatch', 'duplicate_entry', 'time_anomaly',
] as const;

export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const userRole = session.role || 'guru';
    if (!['admin', 'kepala_sekolah', 'wakasek', 'operator'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Role admin diperlukan' }, { status: 403 });
    }

    const url = new URL(req.url);
    const pag = parsePagination(url.searchParams);

    const status = url.searchParams.get('status');
    const teacherName = url.searchParams.get('teacherName');
    const institutionId = url.searchParams.get('institutionId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const flagReason = url.searchParams.get('flagReason');

    const conditions: any[] = [eq(attendanceLogs.status, 'flagged')];
    if (status && status !== 'flagged') {
      conditions[conditions.length - 1] = eq(attendanceLogs.status, status);
    }
    if (teacherName) {
      conditions.push(ilike(users.nama_lengkap, `%${teacherName}%`));
    }
    if (institutionId) {
      conditions.push(eq(attendanceLogs.institutionId, Number(institutionId)));
    }
    if (startDate) {
      conditions.push(gte(attendanceLogs.timestamp, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(attendanceLogs.timestamp, end));
    }
    if (flagReason && flagReason !== 'all') {
      conditions.push(sql`${attendanceLogs.flagReasons}::jsonb ? ${flagReason}`);
    }

    const totalCount = await db
      .select({ count: count() })
      .from(attendanceLogs)
      .leftJoin(users, eq(attendanceLogs.teacherId, users.id))
      .leftJoin(institutions, eq(attendanceLogs.institutionId, institutions.id))
      .where(and(...conditions));

    const total = Number(totalCount[0]?.count || 0);

    const logs = await db
      .select({
        id: attendanceLogs.id,
        teacherId: attendanceLogs.teacherId,
        teacherName: users.nama_lengkap,
        institutionId: attendanceLogs.institutionId,
        institutionName: institutions.name,
        type: attendanceLogs.type,
        timestamp: attendanceLogs.timestamp,
        latitude: attendanceLogs.latitude,
        longitude: attendanceLogs.longitude,
        accuracy: attendanceLogs.accuracy,
        ipAddress: attendanceLogs.ipAddress,
        distanceFromInstitution: attendanceLogs.distanceFromInstitution,
        faceMatchScore: attendanceLogs.faceMatchScore,
        livenessPassed: attendanceLogs.livenessPassed,
        qrCodeVerified: attendanceLogs.qrCodeVerified,
        browserFingerprint: attendanceLogs.browserFingerprint,
        trustScore: attendanceLogs.trustScore,
        status: attendanceLogs.status,
        flagReasons: attendanceLogs.flagReasons,
        createdAt: attendanceLogs.createdAt,
      })
      .from(attendanceLogs)
      .leftJoin(users, eq(attendanceLogs.teacherId, users.id))
      .leftJoin(institutions, eq(attendanceLogs.institutionId, institutions.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceLogs.createdAt))
      .limit(pag.limit)
      .offset(offset(pag));

    const institutionsList = await db.select({
        id: institutions.id,
        name: institutions.name,
      }).from(institutions).limit(100);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: paginationMeta(total, pag),
      filters: {
        status,
        teacherName,
        institutionId,
        startDate,
        endDate,
        flagReason,
      },
      institutions: institutionsList,
      flagReasonOptions: FLAG_REASON_OPTIONS,
    });
  } catch (error) {
    console.error('Attendance logs flagged error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();

    const userRole = session.role || 'guru';
    if (!['admin', 'kepala_sekolah', 'wakasek', 'operator'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { logId, action } = body;

    if (!logId || !action) {
      return NextResponse.json({ error: 'logId dan action wajib diisi' }, { status: 400 });
    }

    const validActions = ['approve', 'reject'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Action tidak valid. Gunakan: approve atau reject' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'valid' : 'rejected';

    await db
      .update(attendanceLogs)
      .set({ status: newStatus })
      .where(eq(attendanceLogs.id, logId));

    return NextResponse.json({
      success: true,
      message: `Presensi berhasil ${action === 'approve' ? 'disetujui' : 'ditolak'}`,
    });
  } catch (error) {
    console.error('Attendance logs action error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
