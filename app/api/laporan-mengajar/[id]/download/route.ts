/**
 * GET /api/laporan-mengajar/[id]/download?format=pdf|docx
 * Download teaching report as DOCX (proper Word format)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { generateTeachingReportHTML, type TeachingReportData } from '@/lib/export/teaching-report';

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'docx';

    const journal = await prisma.teacher_journals.findUnique({
      where: { id },
      include: {
        classes: { select: { nama_kelas: true } },
        subjects: { select: { nama_mapel: true } },
        schools: { select: { nama_sekolah: true, alamat: true, npsn: true, logo: true, nama_kepala_sekolah: true, nip_kepala_sekolah: true } },
        teacher: { select: { nama_lengkap: true, nip: true } },
      },
    });

    if (!journal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Ambil attendance dari teaching session
    const session = await prisma.teaching_sessions.findFirst({
      where: {
        user_id: journal.user_id,
        class_id: journal.class_id,
        subject_id: journal.subject_id,
        session_date: journal.tanggal,
      },
      select: { attendance_data: true },
    });

    let attendance = null;
    if (session?.attendance_data) {
      try {
        const raw = typeof session.attendance_data === 'string'
          ? JSON.parse(session.attendance_data)
          : session.attendance_data;
        // Normalize: support array-of-records dan object format
        if (Array.isArray(raw)) {
          const a = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
          for (const rec of raw) {
            const s = String(rec?.status || '');
            if (s === 'Hadir' || s === 'H') a.hadir++;
            else if (s === 'Izin' || s === 'I') a.izin++;
            else if (s === 'Sakit' || s === 'S') a.sakit++;
            else if (s === 'Alpha' || s === 'A') a.alpha++;
          }
          attendance = a;
        } else if (raw && typeof raw === 'object') {
          attendance = {
            hadir: Number(raw.hadir) || 0,
            izin: Number(raw.izin) || 0,
            sakit: Number(raw.sakit) || 0,
            alpha: Number(raw.alpha) || 0,
          };
        }
      } catch {}
    }

    const reportData: TeachingReportData = {
      tanggal: journal.tanggal.toISOString().split('T')[0],
      guruNama: journal.teacher?.nama_lengkap || '-',
      guruNip: journal.teacher?.nip,
      kelas: journal.classes?.nama_kelas || '-',
      mapel: journal.subjects?.nama_mapel || '-',
      sekolah: journal.schools?.nama_sekolah || '-',
      sekolahAlamat: journal.schools?.alamat,
      sekolahNpsn: journal.schools?.npsn,
      sekolahLogo: journal.schools?.logo,
      kepalaNama: journal.schools?.nama_kepala_sekolah,
      kepalaNip: journal.schools?.nip_kepala_sekolah,
      attendance: attendance || undefined,
      materi: journal.materi_pembelajaran || undefined,
      tujuan: journal.tujuan_pembelajaran || undefined,
      aktivitas: journal.aktivitas_pembelajaran || undefined,
      media: journal.media_pembelajaran || undefined,
      asesmen: journal.asesmen_pembelajaran || undefined,
      refleksi: journal.refleksi_guru || undefined,
      tindakLanjut: journal.tindak_lanjut || undefined,
    };

    const html = generateTeachingReportHTML(reportData, {
      format: 'docx',
      title: `Laporan Mengajar - ${reportData.kelas} - ${reportData.mapel}`,
    });

    const ext = format === 'pdf' ? 'doc' : 'doc'; // Word print-to-PDF
    const filename = `Laporan-Mengajar-${reportData.tanggal}.${ext}`;

    return new Response(html, {
      headers: {
        'Content-Type': 'application/msword',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[laporan-mengajar/[id]/download] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
