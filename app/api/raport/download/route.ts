import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { getNilaiMapelForRaport } from '@/lib/raport/kontak-eksternal-repository';

const DISCLAIMER_PDF = `
Dokumen ini dihasilkan oleh GuruPRO AI sebagai bantuan penyusunan rapor.
Dokumen resmi yang tercatat di sistem e-Rapor/RDM sekolah adalah rujukan utama.
Dicetak pada: {tanggal}
`;

function generateHtmlRaport(siswa: any, nilaiMapel: any[], sekolahInfo: any, tanggal: string) {
  const disclaimer = DISCLAIMER_PDF.replace('{tanggal}', tanggal);

  const nilaiRows = nilaiMapel
    .map(
      (nm: any) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${nm.nama_mapel || '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${nm.nilai_akhir ?? '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${nm.kkm ?? '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;">${nm.deskripsi_capaian || '-'}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 20mm 15mm; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #111; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 16pt; margin: 0 0 4px; }
    .header p { margin: 2px 0; font-size: 11pt; }
    .identitas { margin-bottom: 16px; }
    .identitas table { width: 100%; border-collapse: collapse; }
    .identitas td { padding: 2px 8px; font-size: 11pt; }
    .nilai { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .nilai th { background: #f3f4f6; padding: 8px; border: 1px solid #ddd; font-size: 11pt; text-align: center; }
    .nilai td { padding: 6px 8px; border: 1px solid #ddd; font-size: 11pt; }
    .catatan { margin-top: 20px; }
    .catatan h3 { font-size: 12pt; margin-bottom: 6px; }
    .catatan p { font-size: 11pt; line-height: 1.5; }
    .ttd { margin-top: 40px; display: flex; justify-content: space-between; }
    .ttd div { text-align: center; width: 200px; }
    .ttd p { margin: 4px 0; font-size: 11pt; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; }
    .footer p { font-size: 8pt; color: #666; text-align: center; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RAPOR</h1>
    <p>${sekolahInfo?.nama_sekolah || 'LAPORAN HASIL BELAJAR SISWA'}</p>
    <p>${sekolahInfo?.alamat || ''}</p>
    <p>${sekolahInfo?.npsn ? `NPSN: ${sekolahInfo.npsn}` : ''}</p>
  </div>

  <div class="identitas">
    <table>
      <tr><td width="120"><strong>Nama Siswa</strong></td><td>: ${siswa.nama_siswa}</td></tr>
      <tr><td><strong>NISN</strong></td><td>: ${siswa.nisn || '-'}</td></tr>
      <tr><td><strong>Kelas</strong></td><td>: ${siswa.nama_kelas}</td></tr>
      <tr><td><strong>Periode</strong></td><td>: ${siswa.periode}</td></tr>
    </table>
  </div>

  <h3 style="font-size:12pt;margin-bottom:8px;">Nilai Akademik</h3>
  <table class="nilai">
    <thead>
      <tr>
        <th>Mata Pelajaran</th>
        <th>Nilai</th>
        <th>KKM</th>
        <th>Deskripsi Capaian</th>
      </tr>
    </thead>
    <tbody>
      ${nilaiRows}
    </tbody>
  </table>

  ${siswa.catatan_wali_kelas ? `
  <div class="catatan">
    <h3>Catatan Wali Kelas</h3>
    <p>${siswa.catatan_wali_kelas}</p>
  </div>` : ''}

  <div class="footer">
    <p>${disclaimer}</p>
  </div>
</body>
</html>`;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    const res = await query(
      `SELECT dr.*, s.nama_siswa, s.nisn, s.nis_lokal, c.nama_kelas, tr.nama_template
       FROM data_raport dr
       JOIN students s ON s.id = dr.siswa_id
       JOIN classes c ON c.id = dr.kelas_id
       JOIN template_raport tr ON tr.id = dr.template_raport_id
       WHERE dr.id = $1 LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Raport tidak ditemukan' }, { status: 404 });
    }

    const siswa = res.rows[0];

    const sekolahRes = await query(
      `SELECT s.* FROM schools s
       JOIN classes c ON c.school_id = s.id
       WHERE c.id = $1 LIMIT 1`,
      [siswa.kelas_id]
    );
    const sekolahInfo = sekolahRes.rows[0] || null;

    const tanggal = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const nilaiMapel = await getNilaiMapelForRaport(siswa.id);
    const html = generateHtmlRaport(siswa, nilaiMapel, sekolahInfo, tanggal);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="raport-${siswa.nama_siswa}.html"`,
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
