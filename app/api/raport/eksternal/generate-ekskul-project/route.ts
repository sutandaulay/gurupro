import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getKontakByLinkToken, isOtpVerified } from '@/lib/raport/kontak-eksternal-repository';
import { getPenilaianEkstrakurikuler } from '@/lib/sikap-ekskul';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, contentType, dataRaportIds } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token wajib diisi' }, { status: 400 });
    }

    if (!contentType || !['ekskul', 'project'].includes(contentType)) {
      return NextResponse.json({ error: 'contentType wajib diisi dengan nilai "ekskul" atau "project"' }, { status: 400 });
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

    if (contentType === 'ekskul') {
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
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}