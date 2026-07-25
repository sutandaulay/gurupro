import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { requireSchoolAccess } from '@/lib/school-access';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sekolahId = searchParams.get('sekolah_id');
    const id = searchParams.get('id');

    if (sekolahId) await requireSchoolAccess(sekolahId)

    // Check if table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'template_raport'
      ) as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ error: 'Tabel template_raport belum ada' }, { status: 500 });
    }

    if (id) {
      const res = await query(`SELECT * FROM template_raport WHERE id = $1`, [id]);
      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 });
      }
      return NextResponse.json(res.rows[0]);
    }

    let sql = `SELECT * FROM template_raport`;
    const params: any[] = [];
    let paramIdx = 1;

    if (sekolahId) {
      sql += ` WHERE sekolah_id = $${paramIdx++}`;
      params.push(sekolahId);
    }

    sql += ` ORDER BY is_default DESC, nama_template ASC`;

    const res = await query(sql, params);
    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error('GET template-raport error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      nama_template,
      jenjang,
      kurikulum,
      jenis_laporan,
      mode_nilai_akademik,
      basis_deskripsi,
      sekolah_id,
      jalur_regulasi,
      varian_sikap,
    } = body;

    if (!nama_template || !jenjang || !kurikulum || !jenis_laporan) {
      return NextResponse.json(
        { error: 'nama_template, jenjang, kurikulum, dan jenis_laporan wajib diisi' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }

    // Check if table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'template_raport'
      ) as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ error: 'Tabel template_raport belum ada' }, { status: 500 });
    }

    // Check for duplicate
    const existingCheck = await query(
      `SELECT id FROM template_raport WHERE nama_template = $1 AND sekolah_id = $2`,
      [nama_template, sekolah_id || null]
    );

    if (existingCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Template dengan nama ini sudah ada' },
        { status: 400 }
      );
    }

    const res = await query(
      `INSERT INTO template_raport (
        sekolah_id, nama_template, jalur_regulasi, jenjang, kurikulum,
        jenis_laporan, mode_nilai_akademik, basis_deskripsi, varian_sikap,
        sections, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
      RETURNING *`,
      [
        sekolah_id || null,
        nama_template,
        jalur_regulasi || 'kemendikdasmen',
        jenjang,
        kurikulum,
        jenis_laporan,
        mode_nilai_akademik || 'angka_kkm',
        basis_deskripsi || 'capaian_pembelajaran',
        varian_sikap || 'profil_pelajar_pancasila',
        '[]',
        false,
      ]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('POST template-raport error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
