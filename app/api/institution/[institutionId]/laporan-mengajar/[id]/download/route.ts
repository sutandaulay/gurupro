/**
 * GET /api/institution/[institutionId]/laporan-mengajar/[id]/download?format=pdf|docx
 * Download teaching report as DOCX (proper Word format)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { canViewAllTeachers } from '@/lib/rbac/institution-permissions';
import { generateTeachingReportHTML, type TeachingReportData } from '@/lib/export/teaching-report';

async function checkPermission(institutionId: number): Promise<NextResponse | null> {
  try {
    const session = await requireSession();
    const allowed = await canViewAllTeachers(session.id, institutionId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ institutionId: string; id: string }> }
) {
  const { institutionId, id } = await context.params;
  const instId = parseInt(institutionId, 10);
  if (isNaN(instId)) {
    return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 });
  }

  const permError = await checkPermission(instId);
  if (permError) return permError;

  try {
    const { searchParams } = new URL(request.url);

    const journalResult = await query(
      `SELECT tj.*, u.nama_lengkap as guru_nama, u.nip as guru_nip,
              c.nama_kelas as kelas, s.nama_mapel as mapel,
              sch.nama_sekolah, sch.alamat as sekolah_alamat, sch.npsn as sekolah_npsn,
              sch.logo as sekolah_logo, sch.nama_kepala_sekolah, sch.nip_kepala_sekolah
       FROM teacher_journals tj
       JOIN public.institution_members im ON im.app_user_id = tj.user_id::text AND im.status = 'active'
       JOIN users u ON u.id = tj.user_id
       JOIN classes c ON c.id = tj.class_id
       JOIN subjects s ON s.id = tj.subject_id
       LEFT JOIN schools sch ON sch.id = tj.school_id
       WHERE im.institution_id = $1 AND tj.id = $2`,
      [instId, id]
    );

    if (journalResult.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const row = journalResult.rows[0];

    const sessionResult = await query(
      `SELECT attendance_data FROM teaching_sessions
       WHERE user_id = $1 AND class_id = $2 AND subject_id = $3 AND session_date = $4 LIMIT 1`,
      [row.user_id, row.class_id, row.subject_id, row.tanggal]
    );

    let attendance = null;
    if (sessionResult.rows.length > 0 && sessionResult.rows[0].attendance_data) {
      try {
        const raw = typeof sessionResult.rows[0].attendance_data === 'string'
          ? JSON.parse(sessionResult.rows[0].attendance_data)
          : sessionResult.rows[0].attendance_data;
        if (Array.isArray(raw)) {
          const a = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
          for (const rec of raw) {
            const s = String(rec?.status || '');
            if (s === 'Hadir' || s === 'H') a.hadir++;
            else if (s === 'Izin' || s === 'I') a.izin++;
            else if (s === 'Sakit' || s === 'S') a.sakit++;
            else if (s === 'Alpha' || s === 'A') a.alpha++;
          }
          attendance = a;
        } else if (raw && typeof raw === 'object') {
          attendance = {
            hadir: Number(raw.hadir) || 0,
            izin: Number(raw.izin) || 0,
            sakit: Number(raw.sakit) || 0,
            alpha: Number(raw.alpha) || 0,
          };
        }
      } catch {}
    }

    const reportData: TeachingReportData = {
      tanggal: row.tanggal?.toISOString ? row.tanggal.toISOString().split('T')[0] : String(row.tanggal).split('T')[0],
      guruNama: row.guru_nama || '-',
      guruNip: row.guru_nip,
      kelas: row.kelas || '-',
      mapel: row.mapel || '-',
      sekolah: row.nama_sekolah || '-',
      sekolahAlamat: row.sekolah_alamat,
      sekolahNpsn: row.sekolah_npsn,
      sekolahLogo: row.sekolah_logo,
      kepalaNama: row.nama_kepala_sekolah,
      kepalaNip: row.nip_kepala_sekolah,
      attendance: attendance || undefined,
      materi: row.materi_pembelajaran,
      tujuan: row.tujuan_pembelajaran,
      aktivitas: row.aktivitas_pembelajaran,
      media: row.media_pembelajaran,
      asesmen: row.asesmen_pembelajaran,
      refleksi: row.refleksi_guru,
      tindakLanjut: row.tindak_lanjut,
    };

    const html = generateTeachingReportHTML(reportData, {
      format: 'docx',
      title: `Laporan Mengajar - ${reportData.guruNama} - ${reportData.kelas}`,
    });

    return new Response(html, {
      headers: {
        'Content-Type': 'application/msword',
        'Content-Disposition': `attachment; filename="Laporan-Mengajar-${reportData.tanggal}.doc"`,
      },
    });
  } catch (error) {
    console.error('[institution/laporan-mengajar/[id]/download] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
