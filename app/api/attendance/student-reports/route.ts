import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';
import { getOwnedWaliKelasClassIds } from '@/lib/wali-kelas/dashboard';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { format } from 'date-fns';

const QuerySchema = z.object({
  kelasId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
});

const STATUS_LABELS: Record<string, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alpa: 'Alpa',
};

/**
 * GET /api/attendance/student-reports
 *
 * RBAC: only wali kelas can access. They can only see data for their own classes.
 * Filters: kelasId (required), date range (optional), scheduleId (optional)
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const url = new URL(req.url);
    const params = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const pag = parsePagination(url.searchParams);

    // RBAC: Get owned class IDs for this user
    const ownedClassIds = await getOwnedWaliKelasClassIds(session.id);

    if (ownedClassIds.length === 0) {
      return NextResponse.json(
        { error: 'Anda bukan wali kelas untuk kelas manapun' },
        { status: 403 }
      );
    }

    // If kelasId provided, verify ownership
    if (params.kelasId && !ownedClassIds.includes(params.kelasId)) {
      return NextResponse.json(
        { error: 'Anda bukan wali kelas untuk kelas ini' },
        { status: 403 }
      );
    }

    // Fetch available kelas for this user (for filter dropdown)
    const kelasRes = await query(
      `SELECT c.id, c.nama_kelas, s.nama_sekolah
       FROM classes c
       JOIN schools s ON s.id = c.school_id
       WHERE c.id = ANY($1)
       ORDER BY c.nama_kelas`,
      [ownedClassIds]
    );
    const availableKelas = kelasRes.rows;

    // If no kelasId selected, return kelas list only
    if (!params.kelasId) {
      return NextResponse.json({ data: availableKelas });
    }

    // Resolve start/end dates
    const startDate = params.startDate
      ? format(parseISO(params.startDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');
    const endDate = params.endDate
      ? format(parseISO(params.endDate), 'yyyy-MM-dd')
      : startDate;

    // Build query: get student attendance for this class within date range
    // Join student_attendance -> students -> schedules to get class context
    let sqlWhere = `WHERE s.class_id = $1
                    AND sa.tanggal >= $2::date
                    AND sa.tanggal <= $3::date`;
    const sqlParams: any[] = [params.kelasId, startDate, endDate];
    let paramIdx = 4;

    if (params.scheduleId) {
      sqlWhere += ` AND sa.schedule_id = $${paramIdx}`;
      sqlParams.push(params.scheduleId);
      paramIdx++;
    }

    // Count total DISTINCT student-days (deduplicated by student_id + tanggal)
    const countRes = await query(
      `SELECT COUNT(*)::int as total
       FROM (
         SELECT DISTINCT sa.student_id, sa.tanggal
         FROM student_attendance sa
         JOIN students s ON s.id = sa.student_id
         JOIN schedules sch ON sch.id = sa.schedule_id
         ${sqlWhere}
       ) AS dd`,
      sqlParams
    );
    const total = countRes.rows[0].total;

    // Fetch records: deduplicate to 1 row per (student, date)
    // Use status priority: alpa > izin > sakit > hadir (case-insensitive)
    const offset = (pag.page - 1) * pag.limit;
    const dataRes = await query(
      `WITH ranked AS (
         SELECT
           sa.student_id,
           sa.tanggal,
           LOWER(sa.status) AS status,
           ROW_NUMBER() OVER (
             PARTITION BY sa.student_id, sa.tanggal
             ORDER BY
               CASE LOWER(sa.status) WHEN 'alpa' THEN 1 WHEN 'izin' THEN 2 WHEN 'sakit' THEN 3 WHEN 'hadir' THEN 4 ELSE 5 END,
               sch.jam_mulai ASC NULLS LAST,
               sa.schedule_id ASC
           ) AS rn
         FROM student_attendance sa
         JOIN students s ON s.id = sa.student_id
         JOIN schedules sch ON sch.id = sa.schedule_id
         ${sqlWhere}
       )
       SELECT
         s.id as student_id,
         s.nama_siswa,
         s.nisn,
         s.nomor_absen,
         r.status,
         sa.catatan,
         sa.tanggal
       FROM ranked r
       JOIN students s ON s.id = r.student_id
       JOIN student_attendance sa ON sa.student_id = r.student_id
         AND sa.tanggal = r.tanggal
         AND LOWER(sa.status) = r.status
         AND sa.schedule_id = (
           SELECT sa2.schedule_id
           FROM student_attendance sa2
           JOIN schedules sch2 ON sch2.id = sa2.schedule_id
           WHERE sa2.student_id = r.student_id AND sa2.tanggal = r.tanggal
           ORDER BY
             CASE LOWER(sa2.status) WHEN 'alpa' THEN 1 WHEN 'izin' THEN 2 WHEN 'sakit' THEN 3 WHEN 'hadir' THEN 4 ELSE 5 END,
             sch2.jam_mulai ASC NULLS LAST,
             sa2.schedule_id ASC
           LIMIT 1
         )
       WHERE r.rn = 1
       ORDER BY sa.tanggal DESC, s.nomor_absen ASC NULLS LAST
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...sqlParams, pag.limit, offset]
    );

    // Get class info
    const kelasInfoRes = await query(
      `SELECT c.id, c.nama_kelas, c.wali_kelas, c.wali_kelas_nip, s.nama_sekolah, s.alamat, s.npsn, s.logo,
              u.nama_lengkap as guru_nama, u.signature_url as guru_signature_url
       FROM classes c
       JOIN schools s ON s.id = c.school_id
       LEFT JOIN users u ON u.id = c.wali_kelas_user_id
       WHERE c.id = $1`,
      [params.kelasId]
    );
    const kelasInfo = kelasInfoRes.rows[0] || {};

    // Get kepala sekolah info
    const kepalaRes = await query(
      `SELECT u.nama_lengkap, u.nama_sekolah, u.signature_url
       FROM users u
       WHERE u.nama_sekolah = $1 AND u.role = 'kepala_sekolah'
       LIMIT 1`,
      [kelasInfo.nama_sekolah]
    );
    const kepalaInfo = kepalaRes.rows[0] || {};

    // Get guru pengampu for the schedule (if scheduleId provided)
    let guruPengampu = kelasInfo.guru_nama || kelasInfo.wali_kelas || '-';
    let guruNip = kelasInfo.wali_kelas_nip || null;
    let guruSignatureUrl = kelasInfo.guru_signature_url || null;
    let mapel = null;

    if (params.scheduleId) {
      const scheduleInfoRes = await query(
        `SELECT sch.subject_id, sub.nama_mapel
         FROM schedules sch
         JOIN subjects sub ON sub.id = sch.subject_id
         WHERE sch.id = $1`,
        [params.scheduleId]
      );
      if (scheduleInfoRes.rows[0]) {
        mapel = scheduleInfoRes.rows[0].nama_mapel;
      }
    }

    // Summary — aggregate per distinct student-day (case-insensitive)
    const summaryRes = await query(
      `SELECT
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE r.status = 'hadir')::int as hadir,
         COUNT(*) FILTER (WHERE r.status = 'sakit')::int as sakit,
         COUNT(*) FILTER (WHERE r.status = 'izin')::int as izin,
         COUNT(*) FILTER (WHERE r.status = 'alpa')::int as alpa
       FROM (
         SELECT
           sa.student_id,
           sa.tanggal,
           LOWER(FIRST_VALUE(sa.status) OVER (
             PARTITION BY sa.student_id, sa.tanggal
             ORDER BY
               CASE LOWER(sa.status) WHEN 'alpa' THEN 1 WHEN 'izin' THEN 2 WHEN 'sakit' THEN 3 WHEN 'hadir' THEN 4 ELSE 5 END,
               sch.jam_mulai ASC NULLS LAST,
               sa.schedule_id ASC
           )) AS status
         FROM student_attendance sa
         JOIN students s ON s.id = sa.student_id
         JOIN schedules sch ON sch.id = sa.schedule_id
         ${sqlWhere}
       ) r`,
      sqlParams
    );
    const sum = summaryRes.rows[0];

    // Validate consistency: sum of status counts should equal total
    const sumStatus = (sum.hadir || 0) + (sum.sakit || 0) + (sum.izin || 0) + (sum.alpa || 0);
    if (sumStatus !== sum.total) {
      console.warn(
        `[student-reports] Data inconsistency detected: ` +
        `total=${sum.total} but H(${sum.hadir})+S(${sum.sakit})+I(${sum.izin})+A(${sum.alpa})=${sumStatus}. ` +
        `kelasId=${params.kelasId} range=${startDate}..${endDate}`
      );
    }

    const tingkatKehadiran = sumStatus > 0
      ? Math.round(((sum.hadir || 0) / sumStatus) * 100)
      : 0;

    // Format records for response — 1 row per student per day (no mapel)
    const records = dataRes.rows.map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      namaSiswa: row.nama_siswa,
      nisn: row.nisn,
      nomorAbsen: row.nomor_absen,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status] || row.status,
      catatan: row.catatan,
      tanggal: format(new Date(row.tanggal), 'yyyy-MM-dd'),
      tanggalLabel: format(new Date(row.tanggal), 'EEE, d MMM yyyy', { locale: id }),
    }));

    return NextResponse.json({
      data: {
        records,
        kelas: {
          id: kelasInfo.id,
          nama_kelas: kelasInfo.nama_kelas,
          school_name: kelasInfo.nama_sekolah,
        },
        availableKelas,
        summary: {
          total: sum.total || 0,
          hadir: sum.hadir || 0,
          sakit: sum.sakit || 0,
          izin: sum.izin || 0,
          alpa: sum.alpa || 0,
          tingkatKehadiran,
          dataConsistent: sumStatus === sum.total,
        },
        filters: {
          startDate,
          endDate,
          kelasId: params.kelasId,
          scheduleId: params.scheduleId || null,
        },
        schoolInfo: {
          schoolName: kelasInfo.nama_sekolah,
          schoolAddress: kelasInfo.alamat,
          schoolNpsn: kelasInfo.npsn,
          schoolLogo: kelasInfo.logo,
        },
        kepalaInfo: {
          nama: kepalaInfo.nama_lengkap,
          nip: kepalaInfo.nip,
          signatureUrl: kepalaInfo.signature_url,
        },
        guruInfo: {
          nama: guruPengampu,
          nip: guruNip,
          signatureUrl: guruSignatureUrl,
        },
      },
      pagination: paginationMeta(total, pag),
    });
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/attendance/student-reports error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
