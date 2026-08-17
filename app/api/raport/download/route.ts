import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { getNilaiMapelForRaport } from '@/lib/raport/kontak-eksternal-repository';
import {
  buildKopSekolahHTML,
  buildIdentitasTableHTML,
  buildSignatureBlockHTML,
  buildDocumentFooterHTML,
  buildWordDocTemplate,
  escapeHtml,
  formatTanggalIndonesia,
  getTahunAjaranDariTanggal,
  getSemesterDariTanggal,
  BRAND_DISCLAIMER,
} from '@/lib/export/document-shared';

interface SiswaData {
  nama_siswa: string;
  nisn?: string;
  nis_lokal?: string;
  nama_kelas: string;
  periode?: string;
  semester?: string;
  tahun_ajaran?: string;
  catatan_wali_kelas?: string;
  wali_kelas?: string;
  nip_wali_kelas?: string;
}

interface SekolahInfo {
  nama_sekolah: string;
  alamat?: string;
  npsn?: string;
  nama_kepala_sekolah?: string;
  nip_kepala_sekolah?: string;
  logo?: string;
}

interface NilaiMapel {
  nama_mapel: string;
  nilai_akhir?: number;
  kkm?: number;
  deskripsi_capaian?: string;
}

function generateRaportHTML(
  siswa: SiswaData,
  nilaiMapel: NilaiMapel[],
  sekolahInfo: SekolahInfo,
  raportData: any,
  downloadDate: Date,
  format: 'html' | 'docx',
) {
  const tahunAjaran = siswa.tahun_ajaran || getTahunAjaranDariTanggal(downloadDate);
  const semester = siswa.semester || (getSemesterDariTanggal(downloadDate) === 'ganjil' ? '1' : '2');
  const semesterLabel = semester === '1' ? 'Ganjil' : 'Genap';

  // --- Kop Sekolah ---
  const kopHtml = buildKopSekolahHTML({
    nama_sekolah: sekolahInfo?.nama_sekolah || 'LAPORAN HASIL BELAJAR',
    alamat: sekolahInfo?.alamat,
    npsn: sekolahInfo?.npsn,
    logo: sekolahInfo?.logo,
  });

  // --- Identitas Siswa ---
  const identitasRows: [string, string][] = [
    ['Nama Siswa', siswa.nama_siswa || '-'],
    ['NISN', siswa.nisn || '-'],
    ['NIS Lokal', siswa.nis_lokal || '-'],
    ['Kelas', siswa.nama_kelas || '-'],
    ['Semester', semesterLabel],
    ['Tahun Pelajaran', tahunAjaran],
  ];
  if (siswa.wali_kelas) identitasRows.push(['Wali Kelas', siswa.wali_kelas]);
  if (siswa.nip_wali_kelas) identitasRows.push(['NIP Wali Kelas', siswa.nip_wali_kelas]);
  const identitasHtml = buildIdentitasTableHTML(identitasRows, { col1Width: 160 });

  // --- Tabel Nilai ---
  const nilaiRows = nilaiMapel.map((nm, i) => {
    const rowBg = i % 2 === 0 ? '#fff' : '#f9fafb';
    const predikat = getPredikat(nm.nilai_akhir, nm.kkm);
    return `
    <tr style="background:${rowBg};">
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11pt;">${escapeHtml(nm.nama_mapel || '-')}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:11pt;">${nm.nilai_akhir ?? '-'}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:11pt;">${nm.kkm ?? '-'}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:11pt;">${predikat}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:10pt;">${escapeHtml(nm.deskripsi_capaian || '-')}</td>
    </tr>`;
  }).join('');

  const nilaiTable = `
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr>
        <th style="padding:8px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Mata Pelajaran</th>
        <th style="padding:8px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Nilai</th>
        <th style="padding:8px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">KKM</th>
        <th style="padding:8px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Predikat</th>
        <th style="padding:8px;border:1px solid #000;background:#f3f4f6;font-size:11pt;text-align:center;font-weight:bold;">Deskripsi Capaian</th>
      </tr>
    </thead>
    <tbody>
      ${nilaiRows}
    </tbody>
  </table>`;

  // --- Catatan Wali Kelas ---
  const catatanHtml = siswa.catatan_wali_kelas
    ? `
  <div style="margin-bottom:20px;page-break-inside:avoid;">
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">Catatan Wali Kelas</h3>
    <div style="border:1px solid #000;padding:12px;background:#f9fafb;">
      <p style="margin:0;font-size:11pt;line-height:1.6;text-align:justify;">${escapeHtml(siswa.catatan_wali_kelas)}</p>
    </div>
  </div>`
    : '';

  // --- Tanda Tangan ---
  const signatureHtml = buildSignatureBlockHTML({
    guruNama: siswa.wali_kelas || '-',
    guruNip: siswa.nip_wali_kelas,
    kepalaNama: sekolahInfo?.nama_kepala_sekolah || '-',
    kepalaNip: sekolahInfo?.nip_kepala_sekolah,
    lokasi: sekolahInfo?.nama_sekolah || '',
    tanggal: formatTanggalIndonesia(downloadDate),
  });

  // --- Footer ---
  const footerHtml = buildDocumentFooterHTML({
    showPageNumber: false,
    showDisclaimer: true,
    showDate: true,
    tanggal: formatTanggalIndonesia(downloadDate),
  });

  // --- Body ---
  const body = `
  <div style="text-align:center;margin-bottom:16px;">
    <h1 style="font-size:16pt;font-weight:bold;text-transform:uppercase;margin:0 0 4px;">Laporan Hasil Belajar</h1>
    <p style="margin:0;font-size:12pt;">Semester ${semesterLabel} Tahun Pelajaran ${tahunAjaran}</p>
  </div>

  ${kopHtml}

  <div style="margin-top:8px;">
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">A. Identitas Siswa</h3>
    ${identitasHtml}
  </div>

  <div>
    <h3 style="font-size:12pt;margin-bottom:8px;font-weight:bold;">B. Capaian Hasil Belajar</h3>
    ${nilaiTable}
  </div>

  ${catatanHtml}

  ${signatureHtml}

  ${footerHtml}`;

  if (format === 'docx') {
    return buildWordDocTemplate(body, `Rapor - ${siswa.nama_siswa}`);
  }

  // HTML format
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rapor - ${escapeHtml(siswa.nama_siswa)}</title>
  <style>
    @page { margin: 2.5cm 2cm 2cm 3cm; size: A4; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #111; margin: 0; padding: 0; line-height: 1.5; }
    h1 { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
    h3 { font-size: 12pt; font-weight: bold; }
    p { margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; }
    th { background: #f3f4f6; font-weight: bold; text-align: center; }
    strong { font-weight: bold; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function getPredikat(nilai?: number, kkm?: number): string {
  if (nilai == null) return '-';
  const threshold = kkm || 75;
  if (nilai >= threshold + 30) return 'A';
  if (nilai >= threshold + 20) return 'B+';
  if (nilai >= threshold + 10) return 'B';
  if (nilai >= threshold) return 'C';
  return 'D';
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const format = (searchParams.get('format') || 'docx') as 'html' | 'docx';

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    // Ambil data raport
    const res = await query(
      `SELECT dr.*, s.nama_siswa, s.nisn, s.nis_lokal, c.nama_kelas,
              tr.nama_template,
              u.nama_lengkap as wali_kelas, u.nip as nip_wali_kelas
       FROM data_raport dr
       JOIN students s ON s.id = dr.siswa_id
       JOIN classes c ON c.id = dr.kelas_id
       JOIN template_raport tr ON tr.id = dr.template_raport_id
       LEFT JOIN users u ON u.id = dr.wali_kelas_id
       WHERE dr.id = $1 LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Raport tidak ditemukan' }, { status: 404 });
    }

    const siswa = res.rows[0] as SiswaData;

    // Ambil info sekolah
    const sekolahRes = await query(
      `SELECT s.* FROM schools s
       JOIN classes c ON c.school_id = s.id
       WHERE c.id = $1 LIMIT 1`,
      [siswa.kelas_id]
    );
    const sekolahInfo = sekolahRes.rows[0] as SekolahInfo || {};

    // Ambil data semester & tahun ajaran dari raport jika ada
    const downloadDate = new Date();

    const nilaiMapel = await getNilaiMapelForRaport(siswa.id);

    const html = generateRaportHTML(siswa, nilaiMapel, sekolahInfo, siswa, downloadDate, format);

    const contentType = format === 'docx'
      ? 'application/msword'
      : 'text/html; charset=utf-8';
    const extension = format === 'docx' ? 'doc' : 'html';
    const filename = `Rapor-${(siswa.nama_siswa || 'Siswa').replace(/\s+/g, '_')}-${downloadDate.toISOString().split('T')[0]}.${extension}`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
