import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getKontakByLinkToken, getDataRaportForKelas, isOtpVerified } from '@/lib/raport/kontak-eksternal-repository';
import { getPenilaianEkstrakurikuler } from '@/lib/sikap-ekskul';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, dataRaportIds, contentType = 'raport' } = body;

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

    if (contentType === 'raport') {
      // Get raport data — 1 query, filter di JS
      const allRaports = await getDataRaportForKelas(kontak.kelas_id);
      const raportsToExport = dataRaportIds && dataRaportIds.length > 0
        ? allRaports.filter((r: any) => dataRaportIds.includes(r.id))
        : allRaports;

      // Get nilai for all siswa — 1 query batch
      const raportIds = raportsToExport.map(s => s.id);
      const allNilaiRes = raportIds.length > 0 ? await query(
        `SELECT dnrm.*, sb.nama_mapel
         FROM data_raport_nilai_mapel dnrm
         LEFT JOIN subjects sb ON sb.id = dnrm.mapel_id
         WHERE dnrm.data_raport_id = ANY($1::uuid[])
         ORDER BY dnrm.data_raport_id, sb.nama_mapel ASC`,
        [raportIds]
      ) : { rows: [] };

      const nilaiByRaportId = new Map();
      for (const row of allNilaiRes.rows) {
        const list = nilaiByRaportId.get(row.data_raport_id);
        if (list) { list.push(row); } else { nilaiByRaportId.set(row.data_raport_id, [row]); }
      }

      const allNilai = raportsToExport.map(siswa => ({
        siswa,
        nilaiMapel: nilaiByRaportId.get(siswa.id) || [],
      }));

      // Format data for PDF
      const pdfData = allNilai.map(({ siswa, nilaiMapel }) => ({
        namaSiswa: siswa.nama_siswa,
        nisn: siswa.nisn,
        nomorAbsen: siswa.nomor_absen,
        kelas: siswa.nama_kelas,
        template: siswa.nama_template,
        periode: siswa.periode,
        nilaiMapel: nilaiMapel.map((nm: any) => ({
          mapel: nm.nama_mapel,
          nilai: nm.nilai_akhir,
          deskripsi: nm.deskripsi_capaian,
          predikat: nm.nilai_akhir != null
            ? (nm.nilai_akhir >= (nm.kkm || 70) ? 'Tuntas' : 'Belum Tuntas')
            : '',
          kkm: nm.kkm
        }))
      }));

      return NextResponse.json({
        pdfData,
        totalSiswa: pdfData.length,
        contentType: 'raport',
        message: 'Data raport siap untuk di-generate ke PDF',
      });
    } else if (contentType === 'ekskul') {
      // Get extracurricular data for the class
      const ekskulData = await query(
        `SELECT pe.*, s.nama_siswa, e.nama_ekskul
         FROM penilaian_ekstrakurikuler pe
         JOIN students s ON s.id = pe.siswa_id
         JOIN ekstrakurikuler e ON e.id = pe.ekstrakurikuler_id
         WHERE e.kelas_id = $1
         ORDER BY s.nama_siswa, e.nama_ekskul`,
        [kontak.kelas_id]
      );

      // Group by student
      const groupedByStudent: Record<string, any[]> = {};
      ekskulData.rows.forEach((row: any) => {
        if (!groupedByStudent[row.nama_siswa]) {
          groupedByStudent[row.nama_siswa] = [];
        }
        groupedByStudent[row.nama_siswa].push(row);
      });

      // Format data for PDF
      const pdfData = Object.entries(groupedByStudent).map(([studentName, studentEkskulData]) => ({
        namaSiswa: studentName,
        ekskul: studentEkskulData.map((ekskulItem: any) => ({
          nama: ekskulItem.nama_ekskul,
          nilai: ekskulItem.predikat,
          deskripsi: ekskulItem.deskripsi,
        })),
      }));

      return NextResponse.json({
        pdfData,
        totalSiswa: pdfData.length,
        contentType: 'ekskul',
        message: 'Data ekstrakurikuler siap untuk di-generate ke PDF',
      });
    } else if (contentType === 'project') {
      // For now, we'll return a placeholder since the project module might not be fully implemented
      // In a real implementation, this would query the project-related tables
      return NextResponse.json({
        pdfData: [],
        totalSiswa: 0,
        contentType: 'project',
        message: 'Modul project belum diimplementasikan dalam versi ini',
      });
    } else {
      return NextResponse.json({ error: 'contentType tidak valid. Gunakan: raport, ekskul, atau project' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
