import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireSession } from '@/lib/session';
import {
  getOwnedWaliKelasClassIds,
  getWaliKelasDashboardData,
} from '@/lib/wali-kelas/dashboard';

/**
 * GET /api/wali-kelas/dashboard/export?kelasId=<uuid>&periode=<periode>
 *
 * Exports the wali kelas rekap (presensi + sikap + catatan per siswa) as .xlsx.
 * RBAC: only the homeroom teacher of the requested class may export its data.
 * Styling follows the existing ExcelJS export pattern (app/api/attendance/reports/export).
 */

const SIKAP_VARIAN_LABEL: Record<string, string> = {
  profil_pelajar_pancasila: 'Profil Pelajar Pancasila',
  dimensi_profil_lulusan_madrasah: 'Dimensi Profil Lulusan Madrasah',
  profil_rahmatan_lil_alamin: 'Profil Pelajar Rahmatan Lil Alamin (P2RA)',
};

export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const { searchParams } = new URL(req.url);
    const kelasId = searchParams.get('kelasId') || searchParams.get('kelas_id');
    const periode = searchParams.get('periode');

    if (!kelasId) {
      return NextResponse.json({ error: 'kelasId wajib diisi' }, { status: 400 });
    }
    if (!periode) {
      return NextResponse.json({ error: 'periode wajib diisi' }, { status: 400 });
    }

    const ownedClassIds = await getOwnedWaliKelasClassIds(session.id);
    if (!ownedClassIds.includes(kelasId)) {
      return NextResponse.json(
        { error: 'Forbidden: Anda bukan wali kelas untuk kelas ini' },
        { status: 403 }
      );
    }

    const data = await getWaliKelasDashboardData(kelasId, periode);

    const sikapBySiswa = new Map(data.sikap.map((s) => [s.siswaId, s]));
    const catatanBySiswa = new Map(data.catatan.map((c) => [c.siswaId, c]));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'GuruPRO AI';
    wb.created = new Date();

    const ws = wb.addWorksheet('Rekap Wali Kelas');

    ws.mergeCells('A1:J1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `Rekap Wali Kelas - ${data.kelas.nama_kelas}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:J2');
    const metaCell = ws.getCell('A2');
    metaCell.value = `Periode: ${data.periode}  |  Wali Kelas: ${data.kelas.wali_kelas || '-'}  |  Total Siswa: ${data.statistik.totalSiswa}`;
    metaCell.font = { size: 11, italic: true };
    metaCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(2).height = 18;

    const headers = [
      'No', 'No. Absen', 'Nama Siswa', 'NISN',
      'Sakit', 'Izin', 'Alpa',
      'Varian Sikap', 'Deskripsi Sikap', 'Catatan Wali Kelas',
    ];
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 22;

    data.siswa.forEach((siswa, index) => {
      const sikap = sikapBySiswa.get(siswa.id);
      const catatan = catatanBySiswa.get(siswa.id);
      const row = ws.addRow([
        index + 1,
        siswa.nomor_absen ?? '',
        siswa.nama_siswa,
        siswa.nisn ?? '',
        siswa.status.presensi.sakit,
        siswa.status.presensi.izin,
        siswa.status.presensi.alpa,
        sikap ? SIKAP_VARIAN_LABEL[sikap.varian] || sikap.varian : '',
        sikap?.deskripsiUmum || '',
        catatan?.catatan || '',
      ]);
      row.height = 16;

      const bg = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      });
    });

    ws.columns.forEach((col, i) => {
      if (col) {
        let maxLength = headers[i] ? headers[i].length : 0;
        ws.eachRow({ includeEmpty: false }, (row) => {
          const cell = row.getCell(i + 1);
          if (cell.value != null) {
            const len = String(cell.value).length;
            if (len > maxLength) maxLength = len;
          }
        });
        col.width = Math.min(maxLength + 2, 50);
      }
    });

    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
        if (row.number > 3) {
          cell.font = { size: 11 };
        }
      });
    });

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, activeCell: 'A4' }];

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `rekap-wali-kelas-${data.kelas.nama_kelas.replace(/\s+/g, '_')}-${periode.replace('/', '_')}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/wali-kelas/dashboard/export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
