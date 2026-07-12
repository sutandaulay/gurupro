import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const { npsn } = await req.json();
    if (!npsn || npsn.trim().length < 4) {
      return NextResponse.json({ error: 'NPSN tidak valid' }, { status: 400 });
    }

    // Cari institution by NPSN
    const instResult = await query(
      `SELECT id, name, npsn FROM institutions WHERE npsn = $1 AND status = 'active' LIMIT 1`,
      [npsn.trim()]
    );

    if (instResult.rows.length === 0) {
      return NextResponse.json({ error: 'Institusi dengan NPSN tersebut tidak ditemukan' }, { status: 404 });
    }

    const institution = instResult.rows[0];

    // Cek apakah user sudah terdaftar sebagai anggota
    const cmsUser = await query(
      `SELECT id FROM cms_users WHERE email = (SELECT email FROM users WHERE id = $1) LIMIT 1`,
      [userId]
    );

    if (cmsUser.rows.length === 0) {
      return NextResponse.json({ error: 'Akun CMS tidak ditemukan' }, { status: 400 });
    }

    const existingMember = await query(
      `SELECT id FROM institution_members WHERE user_id = $1 AND institution_id = $2 LIMIT 1`,
      [cmsUser.rows[0].id, institution.id]
    );

    if (existingMember.rows.length > 0) {
      return NextResponse.json({ error: 'Anda sudah terdaftar sebagai anggota institusi ini' }, { status: 409 });
    }

    // Buat institution_members dengan status active
    const newMember = await query(
      `INSERT INTO institution_members (user_id, app_user_id, institution_id, status, joined_at)
       VALUES ($1, $2, $3, 'active', NOW())
       RETURNING id`,
      [cmsUser.rows[0].id, userId, institution.id]
    );

    const memberId = newMember.rows[0].id;

    // Tambah role guru
    await query(
      `INSERT INTO institution_members_role (order, parent_id, value)
       VALUES (1, $1, 'guru')`,
      [memberId]
    );

    // Sync ke user_school_assignments
    const schoolResult = await query(
      `SELECT id FROM schools WHERE npsn = $1 LIMIT 1`,
      [npsn.trim()]
    );

    if (schoolResult.rows.length > 0) {
      const existingAssign = await query(
        `SELECT id FROM user_school_assignments WHERE userid = $1 AND schoolid = $2 LIMIT 1`,
        [userId, schoolResult.rows[0].id]
      );

      if (existingAssign.rows.length === 0) {
        await query(
          `INSERT INTO user_school_assignments (userid, schoolid) VALUES ($1, $2)`,
          [userId, schoolResult.rows[0].id]
        );
      }
    }

    // Update nama_sekolah user
    await query(
      `UPDATE users SET nama_sekolah = $1 WHERE id = $2`,
      [institution.name, userId]
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil terhubung dengan institusi "${institution.name}"`,
    });
  } catch (error: any) {
    console.error('Connect institution error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
