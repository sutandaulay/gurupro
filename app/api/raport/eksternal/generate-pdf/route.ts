import { NextRequest, NextResponse } from 'next/server';
import { getKontakByLinkToken, getDataRaportForKelas, getNilaiMapelForRaport, isOtpVerified } from '@/lib/raport/kontak-eksternal-repository';
import { query } from '@/lib/db';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, dataRaportIds } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token wajib diisi' }, { status: 400 });
    }

    const kontak = await getKontakByLinkToken(token);
    if (!kontak) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 404 });
    }

    if (new Date() > new Date(kontak.otp_expired_at)) {
      return NextResponse.json({ error: 'Link sudah kedaluwarsa' }, { status: 410 });
    }

    // Check if OTP has been verified
    const otpVerified = await isOtpVerified(kontak.id);
    if (!otpVerified) {
      return NextResponse.json({ error: 'Verifikasi OTP diperlukan sebelum mengakses data' }, { status: 403 });
    }

    const sekolahRes = await query(
      `SELECT s.* FROM schools s
       JOIN classes c ON c.school_id = s.id
       WHERE c.id = $1 LIMIT 1`,
      [kontak.kelas_id]
    );
    const sekolahInfo = sekolahRes.rows[0] || null;

    const tanggal = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const raportsToRender = dataRaportIds && dataRaportIds.length > 0
      ? (await Promise.all(
          dataRaportIds.map(async (id: string) => {
            const allRaports = await getDataRaportForKelas(kontak.kelas_id);
            return allRaports.find((r: any) => r.id === id);
          })
        )).filter(Boolean)
      : await getDataRaportForKelas(kontak.kelas_id);

    const htmlParts: string[] = [];

    for (const siswa of raportsToRender) {
      const nilaiMapel = await getNilaiMapelForRaport(siswa.id);
      htmlParts.push(generateHtmlRaport(siswa, nilaiMapel, sekolahInfo, tanggal));
    }

    const fullHtml = htmlParts.join('<div style="page-break-after:always;"></div>');

    return new NextResponse(fullHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="raport-${kontak.kelas_id}.html"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
