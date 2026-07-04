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

    const journals = await prisma.teacher_journals.findMany({
      where: {
        teacher_id: user.id,
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
    });

    const entries = journals.map((j) => ({
      id: j.id,
      jam_mulai: j.schedules?.jam_mulai || '-',
      jam_selesai: j.schedules?.jam_selesai || '-',
      mapel: j.subjects.nama_mapel,
      kelas: j.classes.nama_kelas,
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
    });
  } catch (error: any) {
    console.error('Laporan Harian Detail Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
