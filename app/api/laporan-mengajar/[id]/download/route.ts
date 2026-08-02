/**
 * GET /api/laporan-mengajar/[id]/download?format=pdf|docx
 * Download teaching report as PDF or DOCX
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { generatePdfBuffer, generateDocBuffer } from '@/lib/doc-compiler';

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

function buildReportMarkdown(report: any): string {
  const lines: string[] = [];

  lines.push(`# LAPORAN MENGAJAR`);
  lines.push(``);
  lines.push(`| **Tanggal** | ${report.tanggal} |`);
  lines.push(`| **Guru** | ${report.guru_nama || '-'} |`);
  lines.push(`| **Kelas** | ${report.kelas} |`);
  lines.push(`| **Mata Pelajaran** | ${report.mapel} |`);
  lines.push(`| **Sekolah** | ${report.sekolah || '-'} |`);
  if (report.attendance_summary) {
    const a = report.attendance_summary;
    lines.push(`| **Kehadiran** | Hadir: ${a.hadir || 0}, Izin: ${a.izin || 0}, Sakit: ${a.sakit || 0}, Alpha: ${a.alpha || 0} |`);
  }
  lines.push(``);

  if (report.materi_pembelajaran) {
    lines.push(`## Materi Pembelajaran`);
    lines.push(report.materi_pembelajaran);
    lines.push(``);
  }

  if (report.tujuan_pembelajaran) {
    lines.push(`## Tujuan Pembelajaran`);
    const tujuan = report.tujuan_pembelajaran.split('\n').filter((t: string) => t.trim());
    tujuan.forEach((t: string) => lines.push(`- ${t.trim()}`));
    lines.push(``);
  }

  if (report.aktivitas_pembelajaran) {
    lines.push(`## Aktivitas Pembelajaran`);
    lines.push(report.aktivitas_pembelajaran);
    lines.push(``);
  }

  if (report.media_pembelajaran) {
    lines.push(`## Media Pembelajaran`);
    lines.push(report.media_pembelajaran);
    lines.push(``);
  }

  if (report.asesmen_pembelajaran) {
    lines.push(`## Asesmen Pembelajaran`);
    lines.push(report.asesmen_pembelajaran);
    lines.push(``);
  }

  if (report.refleksi_guru) {
    lines.push(`## Refleksi Guru`);
    lines.push(report.refleksi_guru);
    lines.push(``);
  }

  if (report.tindak_lanjut) {
    lines.push(`## Tindak Lanjut`);
    lines.push(report.tindak_lanjut);
    lines.push(``);
  }

  return lines.join('\n');
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
    const format = searchParams.get('format') || 'pdf';

    const journal = await prisma.teacher_journals.findUnique({
      where: { id },
      include: {
        classes: { select: { nama_kelas: true } },
        subjects: { select: { nama_mapel: true } },
        schools: { select: { nama_sekolah: true } },
        teacher: { select: { nama_lengkap: true } },
      },
    });

    if (!journal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const session = await prisma.teaching_sessions.findFirst({
      where: {
        user_id: journal.user_id,
        class_id: journal.class_id,
        subject_id: journal.subject_id,
        session_date: journal.tanggal,
      },
      select: { attendance_data: true },
    });

    let attendance_summary = null;
    if (session?.attendance_data) {
      try {
        attendance_summary = typeof session.attendance_data === 'string'
          ? JSON.parse(session.attendance_data)
          : session.attendance_data;
      } catch {}
    }

    const reportData = {
      tanggal: journal.tanggal.toISOString().split('T')[0],
      guru_nama: journal.teacher?.nama_lengkap || '-',
      kelas: journal.classes?.nama_kelas || '-',
      mapel: journal.subjects?.nama_mapel || '-',
      sekolah: journal.schools?.nama_sekolah || '-',
      attendance_summary,
      materi_pembelajaran: journal.materi_pembelajaran,
      tujuan_pembelajaran: journal.tujuan_pembelajaran,
      aktivitas_pembelajaran: journal.aktivitas_pembelajaran,
      media_pembelajaran: journal.media_pembelajaran,
      asesmen_pembelajaran: journal.asesmen_pembelajaran,
      refleksi_guru: journal.refleksi_guru,
      tindak_lanjut: journal.tindak_lanjut,
    };

    const markdown = buildReportMarkdown(reportData);
    const title = `Laporan Mengajar - ${reportData.kelas} - ${reportData.mapel}`;

    if (format === 'docx') {
      const buf = generateDocBuffer(markdown, title);
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/msword',
          'Content-Disposition': `attachment; filename="Laporan-Mengajar-${reportData.tanggal}.doc"`,
        },
      });
    }

    const buf = await generatePdfBuffer(markdown, title);
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Laporan-Mengajar-${reportData.tanggal}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('[laporan-mengajar/[id]/download] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
