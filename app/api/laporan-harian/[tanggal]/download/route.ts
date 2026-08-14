import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import {
  escapeHtml,
  formatTanggalIndonesia,
  getTahunAjaranDariTanggal,
  getSemesterDariTanggal,
  buildKopSekolahHTML,
  buildIdentitasTableHTML,
  buildSignatureBlockHTML,
  buildDocumentFooterHTML,
  buildWordDocTemplate,
  BRAND_DISCLAIMER,
} from '@/lib/export/document-shared';
import { parseSessionCookie } from '@/lib/session-sign';

const prisma = new PrismaClient();

async function getCurrentUser() {
  const cookieStore = await cookies();
  return parseSessionCookie(cookieStore.get('gurupro_session')?.value);
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
      select: { role: true, status_langganan: true, subscription_end: true, nama_lengkap: true, nip: true },
    });

    const isPro = userDb?.status_langganan && userDb.status_langganan !== 'free';
    const isExpired = isPro && userDb?.subscription_end && new Date(userDb.subscription_end).getTime() < Date.now();

    if (isExpired && userDb?.role !== 'admin') {
      return NextResponse.json({ error: 'Masa aktif langganan Anda telah berakhir.' }, { status: 403 });
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

    const sekolah = sekolahId
      ? await prisma.schools.findUnique({
          where: { id: sekolahId },
          select: { nama_sekolah: true, alamat: true, npsn: true, logo: true, nama_kepala_sekolah: true, nip_kepala_sekolah: true },
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

    const html = generateDocHtml(user, userDb, sekolah, date, journals, attendance);

    return new Response(html, {
      headers: {
        'Content-Type': 'application/msword',
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
  guru: { nama_lengkap: string | null; nip: string | null } | null,
  sekolah: { nama_sekolah: string | null; alamat: string | null; npsn: string | null; logo: string | null; nama_kepala_sekolah: string | null; nip_kepala_sekolah: string | null } | null,
  date: Date,
  journals: any[],
  attendance: { hadir: number; izin: number; sakit: number; alpha: number; total: number }
): string {
  const hari = date.toLocaleDateString('id-ID', { weekday: 'long' });
  const tanggalFormatted = formatTanggalIndonesia(date);
  const tahunAjaran = getTahunAjaranDariTanggal(date);
  const semester = getSemesterDariTanggal(date);
  const semesterLabel = semester === 'ganjil' ? 'Ganjil' : 'Genap';
  const todayFormatted = formatTanggalIndonesia(new Date());

  // Fallback nama sekolah
  const namaSekolah = sekolah?.nama_sekolah || 'GuruPRO';
  if (!sekolah?.nama_sekolah) {
    console.warn('[laporan-harian] Sekolah tidak ditemukan, menggunakan fallback "GuruPRO"');
  }

  // --- Kop Sekolah ---
  const kopHtml = buildKopSekolahHTML({
    nama_sekolah: namaSekolah,
    alamat: sekolah?.alamat,
    npsn: sekolah?.npsn,
    logo: sekolah?.logo,
  });

  // --- Identitas ---
  const identitasRows: [string, string][] = [
    ['Hari / Tanggal', `${hari}, ${tanggalFormatted}`],
    ['Nama Guru', escapeHtml(guru?.nama_lengkap || user.nama_lengkap || '-')],
    ['NIP', guru?.nip || '-'],
    ['Total Sesi Mengajar', `${journals.length} sesi`],
    ['Semester', semesterLabel],
    ['Tahun Pelajaran', tahunAjaran],
  ];
  const identitasHtml = buildIdentitasTableHTML(identitasRows, { col1Width: 170 });

  // --- Entries ---
  const entriesHtml = journals.map((j, idx) => {
    const lines: { label: string; value: string }[] = [
      { label: 'Jam', value: `${j.schedules?.jam_mulai || '-'} - ${j.schedules?.jam_selesai || '-'}` },
      { label: 'Mata Pelajaran', value: escapeHtml(j.subjects.nama_mapel) },
      { label: 'Kelas', value: escapeHtml(j.classes.nama_kelas) },
      { label: 'Materi', value: escapeHtml(j.materi_pembelajaran || '-') },
      { label: 'Tujuan Pembelajaran', value: escapeHtml(j.tujuan_pembelajaran || '-') },
      { label: 'Aktivitas', value: escapeHtml(j.aktivitas_pembelajaran || '-') },
    ];
    if (j.media_pembelajaran) lines.push({ label: 'Media', value: escapeHtml(j.media_pembelajaran) });
    if (j.asesmen_pembelajaran) lines.push({ label: 'Asesmen', value: escapeHtml(j.asesmen_pembelajaran) });
    if (j.refleksi_guru) lines.push({ label: 'Refleksi', value: escapeHtml(j.refleksi_guru) });
    if (j.tindak_lanjut) lines.push({ label: 'Tindak Lanjut', value: escapeHtml(j.tindak_lanjut) });

    const metaRows = lines
      .map(([label, value]) =>
        `<tr><td style="width:160px;padding:3px 8px 3px 0;font-size:11pt;font-weight:bold;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:3px 0;font-size:11pt;vertical-align:top;">: ${value}</td></tr>`
      )
      .join('\n');

    return `
    <div class="entry" style="margin-bottom:20px;page-break-inside:avoid;">
      <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;">
        ${idx + 1}. ${escapeHtml(j.subjects.nama_mapel)} — Kelas ${escapeHtml(j.classes.nama_kelas)}
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        ${metaRows}
      </table>
    </div>`;
  }).join('\n');

  // --- Kehadiran ---
  const kehadiranHtml = `
  <div style="margin-bottom:20px;page-break-inside:avoid;">
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">Rekapitulasi Kehadiran Siswa</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Hadir</th>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Izin</th>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Sakit</th>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Alpha</th>
          <th style="padding:6px 10px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${attendance.hadir}</td>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${attendance.izin}</td>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${attendance.sakit}</td>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${attendance.alpha}</td>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-size:11pt;">${attendance.total}</td>
        </tr>
      </tbody>
    </table>
  </div>`;

  // --- Tanda Tangan ---
  const signatureHtml = buildSignatureBlockHTML({
    guruNama: guru?.nama_lengkap || user.nama_lengkap || '-',
    guruNip: guru?.nip,
    kepalaNama: sekolah?.nama_kepala_sekolah || '_____________________',
    kepalaNip: sekolah?.nip_kepala_sekolah,
    lokasi: namaSekolah !== 'GuruPRO' ? namaSekolah : undefined,
    tanggal: tanggalFormatted,
  });

  // --- Footer ---
  const footerHtml = buildDocumentFooterHTML({
    showPageNumber: false,
    showDisclaimer: true,
    showDate: true,
    tanggal: todayFormatted,
  });

  // --- Body ---
  const body = `
  <div style="text-align:center;margin-bottom:16px;">
    <h1 style="font-size:16pt;font-weight:bold;text-transform:uppercase;margin:0 0 4px;">Laporan Harian Guru</h1>
    <p style="margin:0;font-size:12pt;">Semester ${semesterLabel} Tahun Pelajaran ${tahunAjaran}</p>
  </div>

  ${kopHtml}

  <div>
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">Identitas Guru</h3>
    ${identitasHtml}
  </div>

  ${kehadiranHtml}

  <div>
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">Detail Kegiatan Mengajar</h3>
    ${entriesHtml}
  </div>

  ${signatureHtml}

  ${footerHtml}`;

  return buildWordDocTemplate(body, `Laporan Harian - ${tanggalFormatted}`);
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
