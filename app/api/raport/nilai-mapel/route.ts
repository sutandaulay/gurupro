import { NextResponse } from 'next/server';
import { query, logAudit } from '@/lib/db';
import { cookies } from 'next/headers';
import { requireSchoolAccess } from '@/lib/school-access';
import { handleNilaiBerubahSetelahKonfirmasi } from '@/lib/raport/repository';
import { parseSessionCookie } from '@/lib/session-sign';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('school_id');
    const dataRaportId = searchParams.get('data_raport_id');

    if (schoolId) await requireSchoolAccess(schoolId)

    if (!dataRaportId) {
      return NextResponse.json({ error: 'data_raport_id wajib diisi' }, { status: 400 });
    }

    const res = await query(
      `SELECT dnrm.*,
              sb.nama_mapel,
              im.app_user_id as guru_user_id,
              u.nama_lengkap as guru_nama
       FROM data_raport_nilai_mapel dnrm
       LEFT JOIN subjects sb ON sb.id = dnrm.mapel_id
        LEFT JOIN public.institution_members im ON im.app_user_id::text = dnrm.guru_mapel_member_id::text
        LEFT JOIN users u ON u.id::text = im.app_user_id
       WHERE dnrm.data_raport_id = $1
       ORDER BY sb.nama_mapel ASC`,
      [dataRaportId]
    );

    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error('GET nilai_mapel error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const userId = session.id;

    const body = await req.json();
    const { data_raport_id, mapel_id, guru_mapel_member_id, nilai_akhir, kkm, deskripsi_capaian, deskripsi_sumber_ai, deskripsi_dibuka_untuk_review, dikonfirmasi_guru } = body;

    if (!data_raport_id || !mapel_id || !guru_mapel_member_id) {
      return NextResponse.json({
        error: 'data_raport_id, mapel_id, dan guru_mapel_member_id wajib diisi'
      }, { status: 400 });
    }

    const guruCheck = await query(
      `SELECT validate_guru_mapel_member($1) as is_guru`,
      [guru_mapel_member_id]
    );

    if (!guruCheck.rows[0]?.is_guru) {
      return NextResponse.json({
        error: 'guru_mapel_member_id bukan role guru'
      }, { status: 403 });
    }

    const existRes = await query(
      `SELECT id FROM data_raport_nilai_mapel
       WHERE data_raport_id = $1 AND mapel_id = $2`,
      [data_raport_id, mapel_id]
    );

    if (existRes.rows.length > 0) {
      const updates: string[] = ['updated_at = now()'];
      const values: any[] = [];
      let idx = 1;

      if (nilai_akhir !== undefined) {
        updates.push(`nilai_akhir = $${idx++}`);
        values.push(nilai_akhir);
      }
      if (kkm !== undefined) {
        updates.push(`kkm = $${idx++}`);
        values.push(kkm);
      }
      if (deskripsi_capaian !== undefined) {
        updates.push(`deskripsi_capaian = $${idx++}`);
        values.push(deskripsi_capaian);
      }
      if (deskripsi_sumber_ai !== undefined) {
        updates.push(`deskripsi_sumber_ai = $${idx++}`);
        values.push(deskripsi_sumber_ai);
      }
      if (deskripsi_dibuka_untuk_review !== undefined) {
        updates.push(`deskripsi_dibuka_untuk_review = $${idx++}`);
        values.push(deskripsi_dibuka_untuk_review);
      }
      if (dikonfirmasi_guru !== undefined) {
        updates.push(`dikonfirmasi_guru = $${idx++}`);
        values.push(dikonfirmasi_guru);
      }

      values.push(data_raport_id, mapel_id);

      await query(
        `UPDATE data_raport_nilai_mapel SET ${updates.join(', ')}
         WHERE data_raport_id = $${idx++} AND mapel_id = $${idx}`,
        values
      );
    } else {
      await query(
        `INSERT INTO data_raport_nilai_mapel
           (data_raport_id, mapel_id, guru_mapel_member_id, nilai_akhir, kkm, deskripsi_capaian, dikonfirmasi_guru, deskripsi_sumber_ai, deskripsi_dibuka_untuk_review)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [data_raport_id, mapel_id, guru_mapel_member_id, nilai_akhir, kkm, deskripsi_capaian || '', dikonfirmasi_guru || false, deskripsi_sumber_ai || false, deskripsi_dibuka_untuk_review || false]
      );
    }

    await logAudit(userId, 'UPDATE_NILAI_MAPEL', `Update nilai mapel ${mapel_id} di raport ${data_raport_id}`);

    // Trigger notification if nilai changed after raport was confirmed/finalized
    // This is a non-blocking operation - we don't wait for it
    (async () => {
      try {
        // Get kelas_id and siswa_id for this raport
        const raportInfo = await query(
          `SELECT kelas_id, siswa_id FROM data_raport WHERE id = $1`,
          [data_raport_id]
        );
        if (raportInfo.rows.length > 0) {
          const { kelas_id, siswa_id } = raportInfo.rows[0];
          await handleNilaiBerubahSetelahKonfirmasi(kelas_id, mapel_id, siswa_id);
        }
      } catch (err) {
        console.error('Failed to handle nilai changed notification:', err);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST nilai_mapel error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
