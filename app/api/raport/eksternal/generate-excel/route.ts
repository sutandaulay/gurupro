import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getKontakByLinkToken, getDataRaportForKelas, getPemetaanKolomProfile, isPemetaanProfileExpired, isOtpVerified } from '@/lib/raport/kontak-eksternal-repository';
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
      const kelasRes = await query(`SELECT school_id FROM classes WHERE id = $1`, [kontak.kelas_id]);
      const sekolahId = kelasRes.rows[0]?.school_id;

      const templateRes = await query(
        `SELECT DISTINCT tr.jalur_regulasi
         FROM data_raport dr
         JOIN template_raport tr ON tr.id = dr.template_raport_id
         WHERE dr.kelas_id = $1 LIMIT 1`,
        [kontak.kelas_id]
      );
      const jalurRegulasi = templateRes.rows[0]?.jalur_regulasi;

      let warning: string | null = null;

      if (sekolahId && jalurRegulasi) {
        const profile = await getPemetaanKolomProfile(sekolahId, jalurRegulasi);
        if (!profile) {
          warning = 'Profil pemetaan kolom belum ada — gunakan urutan default. Cek ulang urutan kolom sebelum tempel.';
        } else if (isPemetaanProfileExpired(profile.last_validated_at)) {
          warning = 'Profil pemetaan kolom sudah lebih dari 1 tahun — cek ulang urutan kolom sebelum tempel.';
        }
      }

      const allRaports = await getDataRaportForKelas(kontak.kelas_id);
      const raportsToExport = dataRaportIds && dataRaportIds.length > 0
        ? allRaports.filter((r: any) => dataRaportIds.includes(r.id))
        : allRaports;

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

      interface RowData {
        nama: string;
        nisn: string;
        nomorAbsen: number | null;
        [key: string]: any;
      }

      const rows: RowData[] = [];
      for (const { siswa, nilaiMapel } of allNilai) {
        const row: RowData = {
          nama: siswa.nama_siswa,
          nisn: siswa.nisn,
          nomorAbsen: siswa.nomor_absen,
        };
        for (const nm of nilaiMapel) {
          row[`${nm.nama_mapel}_nilai`] = nm.nilai_akhir ?? '';
          row[`${nm.nama_mapel}_deskripsi`] = nm.deskripsi_capaian || '';
          row[`${nm.nama_mapel}_predikat`] = nm.nilai_akhir != null
            ? (nm.nilai_akhir >= (nm.kkm || 70) ? 'Tuntas' : 'Belum Tuntas')
            : '';
          row[`${nm.nama_mapel}_kkm`] = nm.kkm ?? '';
        }
        rows.push(row);
      }

      return NextResponse.json({
        rows,
        warning,
        totalSiswa: rows.length,
        contentType: 'raport',
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
        groupedByStudent[row.nama_siswa].forEach(row);
      });

      // Format for export
      const rows = Object.entries(groupedByStudent).map(([studentName, studentEkskulData]) => {
        const row: any = {
          nama: studentName,
        };

        studentEkskulData.forEach((ekskulItem) => {
          const columnName = `${ekskulItem.nama_ekskul}_nilai`;
          const descColumn = `${ekskulItem.nama_ekskul}_deskripsi`;
          
          row[columnName] = ekskulItem.predikat || '';
          row[descColumn] = ekskulItem.deskripsi || '';
        });

        return row;
      });

      return NextResponse.json({
        rows,
        totalSiswa: rows.length,
        contentType: 'ekskul',
      });
    } else if (contentType === 'project') {
      // For now, we'll return a placeholder since the project module might not be fully implemented
      // In a real implementation, this would query the project-related tables
      return NextResponse.json({
        rows: [],
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