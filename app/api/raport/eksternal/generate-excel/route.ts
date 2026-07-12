import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getKontakByLinkToken, getDataRaportForKelas, getNilaiMapelForRaport, getPemetaanKolomProfile, isPemetaanProfileExpired, isOtpVerified } from '@/lib/raport/kontak-eksternal-repository';

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

    const raportsToExport = dataRaportIds && dataRaportIds.length > 0
      ? (await Promise.all(
          dataRaportIds.map(async (id: string) => {
            const allRaports = await getDataRaportForKelas(kontak.kelas_id);
            return allRaports.find((r: any) => r.id === id);
          })
        )).filter(Boolean)
      : await getDataRaportForKelas(kontak.kelas_id);

    const allNilai = await Promise.all(
      raportsToExport.map(async (siswa: any) => {
        const nilaiMapel = await getNilaiMapelForRaport(siswa.id);
        return { siswa, nilaiMapel };
      })
    );

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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
