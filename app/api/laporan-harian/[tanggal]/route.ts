import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session');
  if (!sessionCookie?.value) return null;
  try {
    return JSON.parse(sessionCookie.value);
  } catch {
    return null;
  }
}

type AttendanceSummary = {
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  total: number;
};

function normalizeAttendance(data: unknown): AttendanceSummary {
  const empty: AttendanceSummary = { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 };
  if (!data) return empty;

  let parsed: any = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return empty;
    }
  }

  // Format ringkasan: { hadir, izin, sakit, alpha, total }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'hadir' in parsed) {
    return {
      hadir: Number(parsed.hadir) || 0,
      izin: Number(parsed.izin) || 0,
      sakit: Number(parsed.sakit) || 0,
      alpha: Number(parsed.alpha) || 0,
      total: Number(parsed.total) || 0,
    };
  }

  // Format array per-siswa: [{ student_id, status, catatan }]
  if (Array.isArray(parsed)) {
    const result = { ...empty };
    for (const rec of parsed) {
      const status = String(rec?.status || '');
      if (status === 'Hadir') result.hadir++;
      else if (status === 'Izin') result.izin++;
      else if (status === 'Sakit') result.sakit++;
      else if (status === 'Alpha') result.alpha++;
      else if (status === 'S') result.sakit++;
      else if (status === 'I') result.izin++;
      else if (status === 'H') result.hadir++;
      else if (status === 'A') result.alpha++;
    }
    result.total = parsed.length;
    return result;
  }

  return empty;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tanggal: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sekolahId = searchParams.get('sekolah_id');

    const { tanggal } = await params;
    const date = new Date(tanggal);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const [journals, sessions, guru, sekolah] = await Promise.all([
      prisma.teacher_journals.findMany({
        where: {
          user_id: user.id,
          ...(sekolahId ? { school_id: sekolahId } : {}),
          tanggal: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          classes: { select: { nama_kelas: true } },
          subjects: { select: { nama_mapel: true } },
          schedules: { select: { jam_mulai: true, jam_selesai: true } },
        },
        orderBy: { created_at: 'asc' },
      }),
      prisma.teaching_sessions.findMany({
        where: {
          user_id: user.id,
          session_date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { attendance_data: true },
      }),
      prisma.users.findUnique({
        where: { id: user.id },
        select: { nama_lengkap: true },
      }),
      sekolahId
        ? prisma.schools.findUnique({
            where: { id: sekolahId },
            select: { nama_sekolah: true, nama_kepala_sekolah: true, nip_kepala_sekolah: true },
          })
        : null,
    ]);

    // Agregasi kehadiran dari semua sesi pada hari itu
    const attendance = sessions.reduce<AttendanceSummary>(
      (acc, s) => {
        const norm = normalizeAttendance(s.attendance_data);
        acc.hadir += norm.hadir;
        acc.izin += norm.izin;
        acc.sakit += norm.sakit;
        acc.alpha += norm.alpha;
        acc.total += norm.total;
        return acc;
      },
      { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 }
    );

    const entries = journals.map((j) => ({
      id: j.id,
      jam_mulai: j.schedules?.jam_mulai || '-',
      jam_selesai: j.schedules?.jam_selesai || '-',
      mapel: j.subjects?.nama_mapel || '-',
      kelas: j.classes?.nama_kelas || '-',
      materi_pembelajaran: j.materi_pembelajaran,
      tujuan_pembelajaran: j.tujuan_pembelajaran,
      aktivitas_pembelajaran: j.aktivitas_pembelajaran,
      media_pembelajaran: j.media_pembelajaran,
      asesmen_pembelajaran: j.asesmen_pembelajaran,
      refleksi_guru: j.refleksi_guru,
      tindak_lanjut: j.tindak_lanjut,
      status: j.status,
      auto_generated: j.auto_generated,
    }));

    return NextResponse.json({
      tanggal,
      hari: date.toLocaleDateString('id-ID', { weekday: 'long' }),
      tanggal_formatted: date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      total_mengajar: entries.length,
      entries,
      attendance,
      guru: {
        nama_lengkap: guru?.nama_lengkap || user.nama_lengkap || '-',
        nip: user.nip || '',
      },
      sekolah: sekolah
        ? {
            nama_sekolah: sekolah.nama_sekolah || '-',
            nama_kepala_sekolah: sekolah.nama_kepala_sekolah || '',
            nip_kepala_sekolah: sekolah.nip_kepala_sekolah || '',
          }
        : null,
    });
  } catch (error: any) {
    console.error('Laporan Harian Detail Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
