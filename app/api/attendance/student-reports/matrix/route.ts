import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { query } from '@/lib/db';
import { getOwnedWaliKelasClassIds } from '@/lib/wali-kelas/dashboard';
import { parseISO, format, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';

const QuerySchema = z.object({
  kelasId: z.string().uuid(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/attendance/student-reports/matrix
 *
 * Returns attendance data in matrix format (students x dates).
 * Used by the matrix view in the UI and for Excel/PDF matrix export.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const params = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const ownedClassIds = await getOwnedWaliKelasClassIds(session.id);
    if (!ownedClassIds.includes(params.kelasId)) {
      return NextResponse.json({ error: 'Anda bukan wali kelas untuk kelas ini' }, { status: 403 });
    }

    const startDate = params.startDate
      ? format(parseISO(params.startDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');
    const endDate = params.endDate
      ? format(parseISO(params.endDate), 'yyyy-MM-dd')
      : startDate;

    // Get class + school info
    const kelasRes = await query(
      `SELECT c.id, c.nama_kelas, c.wali_kelas, c.wali_kelas_nip, s.nama_sekolah,
              s.alamat, s.npsn, s.logo,
              u.nama_lengkap as guru_nama, u.signature_url as guru_signature_url
       FROM classes c
       JOIN schools s ON s.id = c.school_id
       LEFT JOIN users u ON u.id = c.wali_kelas_user_id
       WHERE c.id = $1`,
      [params.kelasId]
    );
    const kelasInfo = kelasRes.rows[0] || {};

    // Get kepala sekolah
    const kepalaRes = await query(
      `SELECT u.nama_lengkap, u.signature_url
       FROM users u
       WHERE u.nama_sekolah = $1 AND u.role = 'kepala_sekolah'
       LIMIT 1`,
      [kelasInfo.nama_sekolah]
    );
    const kepalaInfo = kepalaRes.rows[0] || {};

    // Get ALL students in this class
    const studentsRes = await query(
      `SELECT id, nama_siswa, nisn, nomor_absen
       FROM students
       WHERE class_id = $1
       ORDER BY nomor_absen ASC NULLS LAST, nama_siswa ASC`,
      [params.kelasId]
    );
    const students = studentsRes.rows;

    // Get all dates in range
    const dates = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });
    const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));
    const dateLabels = dates.map(d => format(d, 'EEE, d MMM', { locale: id }));

    // Get all attendance records for this class+range (case-insensitive, deduplicated per student-day)
    const recordsRes = await query(
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
         WHERE s.class_id = $1
           AND sa.tanggal >= $2::date
           AND sa.tanggal <= $3::date
       )
       SELECT r.student_id, r.tanggal, r.status, sa.catatan
       FROM ranked r
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
       WHERE r.rn = 1`,
      [params.kelasId, startDate, endDate]
    );

    // Index records by student_id + tanggal
    const recordMap: Record<string, { status: string; catatan: string }> = {};
    for (const row of recordsRes.rows) {
      const key = `${row.student_id}__${format(new Date(row.tanggal), 'yyyy-MM-dd')}`;
      recordMap[key] = { status: row.status, catatan: row.catatan };
    }

    // Build matrix: each student has a map of date -> {status, catatan}
    const matrix = students.map(s => {
      const perDate: Record<string, { status: string; catatan: string } | null> = {};
      for (const ds of dateStrings) {
        perDate[ds] = recordMap[`${s.id}__${ds}`] || null;
      }
      return { studentId: s.id, namaSiswa: s.nama_siswa, nisn: s.nisn, nomorAbsen: s.nomor_absen, perDate };
    });

    // Summary (case-insensitive)
    const summaryRes = await query(
      `SELECT
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE r.status = 'hadir')::int as hadir,
         COUNT(*) FILTER (WHERE r.status = 'sakit')::int as sakit,
         COUNT(*) FILTER (WHERE r.status = 'izin')::int as izin,
         COUNT(*) FILTER (WHERE r.status = 'alpa')::int as alpa
       FROM (
         SELECT
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
         WHERE s.class_id = $1 AND sa.tanggal >= $2::date AND sa.tanggal <= $3::date
       ) r`,
      [params.kelasId, startDate, endDate]
    );
    const sum = summaryRes.rows[0];
    const sumStatus = (sum.hadir || 0) + (sum.sakit || 0) + (sum.izin || 0) + (sum.alpa || 0);

    if (sumStatus !== sum.total) {
      console.warn(`[matrix] Data inconsistency: total=${sum.total} but sum=${sumStatus}`);
    }

    const tingkatKehadiran = sumStatus > 0
      ? Math.round(((sum.hadir || 0) / sumStatus) * 100)
      : 0;

    return NextResponse.json({
      students: matrix,
      dates: dateStrings,
      dateLabels,
      summary: {
        total: sum.total || 0,
        hadir: sum.hadir || 0,
        sakit: sum.sakit || 0,
        izin: sum.izin || 0,
        alpa: sum.alpa || 0,
        tingkatKehadiran,
        dataConsistent: sumStatus === sum.total,
      },
      schoolInfo: {
        schoolName: kelasInfo.nama_sekolah,
        schoolAddress: kelasInfo.alamat,
        schoolNpsn: kelasInfo.npsn,
        schoolLogo: kelasInfo.logo,
        kelas: kelasInfo.nama_kelas,
        guruPengampu: kelasInfo.guru_nama || kelasInfo.wali_kelas || '-',
        guruNip: kelasInfo.wali_kelas_nip,
        guruSignatureUrl: kelasInfo.guru_signature_url,
      },
      kepalaInfo: {
        nama: kepalaInfo.nama_lengkap,
        signatureUrl: kepalaInfo.signature_url,
      },
      filters: { startDate, endDate, kelasId: params.kelasId },
    });
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/attendance/student-reports/matrix error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
