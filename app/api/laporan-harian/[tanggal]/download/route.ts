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

    const userDb = await prisma.users.findUnique({
      where: { id: user.id },
      select: { role: true, status_langganan: true, subscription_end: true },
    });

    const isPro = userDb?.status_langganan && userDb.status_langganan !== 'free';
    const isExpired = isPro && userDb.subscription_end && new Date(userDb.subscription_end).getTime() < Date.now();

    if (isExpired && userDb.role !== 'admin') {
      return NextResponse.json({ error: 'Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk mencetak atau mengunduh laporan harian.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sekolahId = searchParams.get('sekolah_id');

    const { tanggal } = await params;
    const date = new Date(tanggal);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const guru = await prisma.users.findUnique({
      where: { id: user.id },
      select: { nama_lengkap: true },
    });

    const sekolah = sekolahId
      ? await prisma.schools.findUnique({
          where: { id: sekolahId },
          select: { nama_sekolah: true, nama_kepala_sekolah: true, nip_kepala_sekolah: true },
        })
      : null;

    const journals = await prisma.teacher_journals.findMany({
      where: {
        user_id: user.id,
        ...(sekolahId ? { school_id: sekolahId } : {}),
        tanggal: { gte: startDate, lte: endDate },
      },
      include: {
        classes: { select: { nama_kelas: true } },
        subjects: { select: { nama_mapel: true } },
        schedules: { select: { jam_mulai: true, jam_selesai: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const sessions = await prisma.teaching_sessions.findMany({
      where: {
        user_id: user.id,
        session_date: { gte: startDate, lte: endDate },
      },
      select: { attendance_data: true },
    });

    const attendance = aggregateAttendance(sessions);

    const html = generateDocHtml(user, guru, sekolah, tanggal, journals, attendance);

    return new Response(html, {
      headers: {
        'Content-Type': 'application/vnd.ms-word',
        'Content-Disposition': `attachment; filename="LaporanHarian_${tanggal}.doc"`,
      },
    });
  } catch (error: any) {
    console.error('Download Laporan Harian Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateDocHtml(
  user: any,
  guru: { nama_lengkap: string | null } | null,
  sekolah: { nama_sekolah: string | null; nama_kepala_sekolah: string | null; nip_kepala_sekolah: string | null } | null,
  tanggal: string,
  journals: any[],
  attendance: { hadir: number; izin: number; sakit: number; alpha: number; total: number }
): string {
  const date = new Date(tanggal);
  const hari = date.toLocaleDateString('id-ID', { weekday: 'long' });
  const tanggalFormatted = date.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const entriesHtml = journals.map((j, idx) => `
    <div class="entry">
      <h3>${idx + 1}. ${escapeHtml(j.subjects.nama_mapel)} — Kelas ${escapeHtml(j.classes.nama_kelas)}</h3>
      <table class="meta-table">
        <tr><td>Jam</td><td>: ${j.schedules?.jam_mulai || '-'} - ${j.schedules?.jam_selesai || '-'}</td></tr>
        <tr><td>Materi</td><td>: ${escapeHtml(j.materi_pembelajaran)}</td></tr>
        <tr><td>Tujuan Pembelajaran</td><td>: ${escapeHtml(j.tujuan_pembelajaran)}</td></tr>
        <tr><td>Aktivitas</td><td>: ${escapeHtml(j.aktivitas_pembelajaran)}</td></tr>
        ${j.media_pembelajaran ? `<tr><td>Media</td><td>: ${escapeHtml(j.media_pembelajaran)}</td></tr>` : ''}
        ${j.asesmen_pembelajaran ? `<tr><td>Asesmen</td><td>: ${escapeHtml(j.asesmen_pembelajaran)}</td></tr>` : ''}
        ${j.refleksi_guru ? `<tr><td>Refleksi</td><td>: ${escapeHtml(j.refleksi_guru)}</td></tr>` : ''}
        ${j.tindak_lanjut ? `<tr><td>Tindak Lanjut</td><td>: ${escapeHtml(j.tindak_lanjut)}</td></tr>` : ''}
      </table>
    </div>
  `).join('\n');

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const namaKS = sekolah?.nama_kepala_sekolah || '_____________________';
  const nipKS = sekolah?.nip_kepala_sekolah || '_____________________';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Laporan Harian Guru - ${tanggal}</title>
  <style>
    @page { margin: 2.5cm 3cm; size: A4; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; max-width: 100%; padding: 0; margin: 0; line-height: 1.6; font-size: 12pt; color: #000; }
    h1 { text-align: center; font-size: 16pt; margin-bottom: 4px; font-weight: bold; text-transform: uppercase; }
    h2 { font-size: 13pt; margin-top: 20px; margin-bottom: 10px; font-weight: bold; }
    h3 { font-size: 12pt; margin-top: 16px; margin-bottom: 8px; font-weight: bold; }
    p { margin: 6px 0; text-align: justify; }
    .header { text-align: center; margin-bottom: 30px; }
    .header-line { border-bottom: 2px solid #000; margin-top: 6px; margin-bottom: 20px; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
    .meta-table td { padding: 3px 6px; vertical-align: top; font-size: 12pt; }
    .meta-table td:first-child { width: 140px; font-weight: bold; }
    .entry { margin-bottom: 20px; page-break-inside: avoid; }
    .entry h3 { border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .identitas-box { margin-bottom: 20px; padding: 12px; border: 1px solid #000; page-break-inside: avoid; }
    .identitas-box h3 { margin-top: 0; text-align: center; }
    .attendance-box { margin-bottom: 20px; padding: 12px; border: 1px solid #000; page-break-inside: avoid; }
    .attendance-box h3 { margin-top: 0; text-align: center; }
    .attendance-table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; }
    .attendance-table th, .attendance-table td { border: 1px solid #000; padding: 6px 10px; text-align: center; font-size: 12pt; }
    .attendance-table th { font-weight: bold; }
    .footer { margin-top: 40px; text-align: center; font-size: 10pt; }
    .signature { margin-top: 30px; }
    .signature-table { width: 100%; margin-top: 20px; }
    .signature-table td { width: 50%; text-align: center; vertical-align: top; }
    .signature-space { height: 80px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Laporan Harian Guru</h1>
    ${sekolah?.nama_sekolah ? `<p style="text-indent:0;text-align:center;font-size:13pt;font-weight:bold;">${escapeHtml(sekolah.nama_sekolah)}</p>` : ''}
    <p style="text-indent:0;text-align:center;">${hari}, ${tanggalFormatted}</p>
    <div class="header-line"></div>
  </div>

  <div class="identitas-box">
    <h3>Identitas Guru</h3>
    <table class="meta-table">
      <tr><td>Nama</td><td>: ${escapeHtml(guru?.nama_lengkap || user.nama_lengkap || '-')}</td></tr>
      <tr><td>Sekolah</td><td>: ${escapeHtml(sekolah?.nama_sekolah || '-')}</td></tr>
      <tr><td>Total Sesi Mengajar</td><td>: ${journals.length} sesi</td></tr>
    </table>
  </div>

  <div class="attendance-box">
    <h3>Rekapitulasi Kehadiran Siswa</h3>
    <table class="attendance-table">
      <tr>
        <th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpha</th><th>Total</th>
      </tr>
      <tr>
        <td>${attendance.hadir}</td>
        <td>${attendance.izin}</td>
        <td>${attendance.sakit}</td>
        <td>${attendance.alpha}</td>
        <td>${attendance.total}</td>
      </tr>
    </table>
  </div>

  ${entriesHtml}

  <div class="signature">
    <div class="header-line" style="margin-top:30px;"></div>
    <table class="signature-table">
      <tr>
        <td>
          <p>Mengetahui,<br/>Kepala Sekolah</p>
          <div class="signature-space"></div>
          <p style="text-decoration:underline;font-weight:bold;">${escapeHtml(namaKS)}</p>
          <p>NIP. ${escapeHtml(nipKS)}</p>
        </td>
        <td>
          <p>Guru,</p>
          <div class="signature-space"></div>
          <p style="text-decoration:underline;font-weight:bold;">${escapeHtml(guru?.nama_lengkap || user.nama_lengkap || '_____________________')}</p>
        </td>
      </tr>
    </table>
  </div>

  <div class="footer">
    <p style="text-indent:0;text-align:center;">Dicetak pada ${todayFormatted}</p>
    <p style="text-indent:0;text-align:center;"><em>Dokumen ini dihasilkan oleh GuruPRO</em></p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeAttendance(data: unknown): { hadir: number; izin: number; sakit: number; alpha: number; total: number } {
  const empty = { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 };
  if (!data) return empty;

  let parsed: any = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return empty;
    }
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'hadir' in parsed) {
    return {
      hadir: Number(parsed.hadir) || 0,
      izin: Number(parsed.izin) || 0,
      sakit: Number(parsed.sakit) || 0,
      alpha: Number(parsed.alpha) || 0,
      total: Number(parsed.total) || 0,
    };
  }

  if (Array.isArray(parsed)) {
    const result = { ...empty };
    for (const rec of parsed) {
      const status = String(rec?.status || '');
      if (status === 'Hadir' || status === 'H') result.hadir++;
      else if (status === 'Izin' || status === 'I') result.izin++;
      else if (status === 'Sakit' || status === 'S') result.sakit++;
      else if (status === 'Alpha' || status === 'A') result.alpha++;
    }
    result.total = parsed.length;
    return result;
  }

  return empty;
}

function aggregateAttendance(
  sessions: { attendance_data: unknown }[]
): { hadir: number; izin: number; sakit: number; alpha: number; total: number } {
  return sessions.reduce(
    (acc, s) => {
      const n = normalizeAttendance(s.attendance_data);
      acc.hadir += n.hadir;
      acc.izin += n.izin;
      acc.sakit += n.sakit;
      acc.alpha += n.alpha;
      acc.total += n.total;
      return acc;
    },
    { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 }
  );
}
