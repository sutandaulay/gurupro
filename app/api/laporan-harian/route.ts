import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { getContextFilters } from '@/lib/session';

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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filters = await getContextFilters(user.id);

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'hari_ini';
    const tanggalParam = searchParams.get('tanggal');
    const sekolahId = searchParams.get('sekolah_id');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;
    let endDate: Date = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    if (tanggalParam) {
      startDate = new Date(tanggalParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(tanggalParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (filter) {
        case 'hari_ini':
          startDate = new Date(today);
          break;
        case 'kemarin':
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 1);
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'minggu_ini': {
          const dayOfWeek = today.getDay();
          const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate = new Date(today);
          startDate.setDate(today.getDate() - diff);
          break;
        }
        case 'bulan_ini':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        default:
          startDate = new Date(today);
      }
    }

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
      },
      orderBy: { tanggal: 'desc' },
    });

    let filteredJournals = journals;
    if (filters.assignedMapel.length > 0 || filters.assignedKelas.length > 0) {
      filteredJournals = journals.filter((j: any) => {
        const matchMapel = filters.assignedMapel.length === 0 ||
          (j.subjects?.nama_mapel && filters.assignedMapel.some((m) =>
            j.subjects.nama_mapel.toLowerCase().includes(m.toLowerCase())
          ));
        const matchKelas = filters.assignedKelas.length === 0 ||
          (j.classes?.nama_kelas && filters.assignedKelas.some((k) =>
            j.classes.nama_kelas.toLowerCase().includes(k.toLowerCase())
          ));
        return matchMapel && matchKelas;
      });
    }

    const groupedMap = new Map<string, typeof filteredJournals>();
    for (const j of filteredJournals) {
      const key = j.tanggal.toISOString().split('T')[0];
      if (!groupedMap.has(key)) groupedMap.set(key, []);
      groupedMap.get(key)!.push(j);
    }

    const reports = Array.from(groupedMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([tanggal, entries]) => ({
        tanggal,
        hari: new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long' }),
        total_mengajar: entries.length,
        mapel: [...new Set(entries.map((e) => e.subjects.nama_mapel))],
        kelas: [...new Set(entries.map((e) => e.classes.nama_kelas))],
        entries: entries.map((e) => ({
          id: e.id,
          mapel: e.subjects.nama_mapel,
          kelas: e.classes.nama_kelas,
          materi: e.materi_pembelajaran,
          status: e.status,
        })),
      }));

    const totalMengajar = filteredJournals.length;

    return NextResponse.json({
      reports,
      summary: {
        total_hari: reports.length,
        total_mengajar: totalMengajar,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      },
    });
  } catch (error: any) {
    console.error('Laporan Harian Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
