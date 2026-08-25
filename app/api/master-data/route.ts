import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { parseSessionCookie } from '@/lib/session-sign';

async function getUserId() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session.id;
}

/**
 * GET /api/master-data
 * Returns the user's owned school (if any), their classes, and their ekskul.
 * Used by the Master Data dashboard page for individual teachers.
 */
export async function GET() {
  try {
    const userId = await getUserId();

    // Get user's owned school (individual mode: schools.user_id = users.id)
    const schoolsRes = await query(
      `SELECT id, nama_sekolah, logo, alamat, npsn, created_at
       FROM schools WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const school = schoolsRes.rows[0] || null;

    // If no school, return empty data
    if (!school) {
      return NextResponse.json({
        data: {
          school: null,
          classes: [],
          ekskul: [],
        },
      });
    }

    // Get classes owned by this school
    const classesRes = await query(
      `SELECT c.id, c.school_id, c.nama_kelas, c.wali_kelas, c.wali_kelas_nip,
              c.wali_kelas_user_id,
              CASE WHEN c.wali_kelas_user_id = $1 THEN true ELSE false END as is_wali_kelas
       FROM classes c
       WHERE c.school_id = $2
       ORDER BY c.nama_kelas ASC`,
      [userId, school.id]
    );

    // Get ekskul where user is pembina (individual mode: pembina_user_id = users.id)
    const ekskulRes = await query(
      `SELECT e.id, e.nama_ekskul, e.kelas_id, e.pembina_user_id,
              c.nama_kelas
       FROM ekstrakurikuler e
       LEFT JOIN classes c ON c.id = e.kelas_id
       WHERE e.pembina_user_id = $1
       ORDER BY e.nama_ekskul ASC`,
      [userId]
    );

    return NextResponse.json({
      data: {
        school,
        classes: classesRes.rows,
        ekskul: ekskulRes.rows,
      },
    });
  } catch (error: any) {
    console.error('GET /api/master-data error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// =====================================================
// POST /api/master-data
// Handles: create/update kelas, create/update/delete ekskul
// =====================================================

export async function POST(req: Request) {
  try {
    const userId = await getUserId();

    const body = await req.json();
    const { action, kelas, ekskul } = body;

    // Get user's owned school
    const schoolRes = await query(
      'SELECT id FROM schools WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (!schoolRes.rows[0]) {
      return NextResponse.json({ error: 'Sekolah tidak ditemukan. Buat sekolah terlebih dahulu.' }, { status: 400 });
    }
    const schoolId = schoolRes.rows[0].id;

    // === KELAS CRUD ===
    if (action === 'upsertKelas') {
      const { id, nama_kelas, wali_kelas, wali_kelas_nip, saya_wali_kelas } = kelas;

      if (!nama_kelas || !nama_kelas.trim()) {
        return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 });
      }

      if (id) {
        // Update
        const updatewaliKelasUserId = saya_wali_kelas ? userId : null;
        const res = await query(
          `UPDATE classes SET nama_kelas = $1, wali_kelas = $2, wali_kelas_nip = $3,
           wali_kelas_user_id = $4 WHERE id = $5 AND school_id = $6 RETURNING *`,
          [
            nama_kelas.trim(),
            wali_kelas ? wali_kelas.trim() : null,
            wali_kelas_nip ? wali_kelas_nip.trim() : null,
            updatewaliKelasUserId,
            id,
            schoolId,
          ]
        );
        if (!res.rows[0]) {
          return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
        }
        return NextResponse.json({ data: res.rows[0] });
      } else {
        // Insert
        const res = await query(
          `INSERT INTO classes (school_id, nama_kelas, wali_kelas, wali_kelas_nip, wali_kelas_user_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            schoolId,
            nama_kelas.trim(),
            wali_kelas ? wali_kelas.trim() : null,
            wali_kelas_nip ? wali_kelas_nip.trim() : null,
            saya_wali_kelas ? userId : null,
          ]
        );
        return NextResponse.json({ data: res.rows[0] }, { status: 201 });
      }
    }

    // === EKSKUL CRUD ===
    if (action === 'upsertEkskul') {
      const { id, nama_ekskul, kelas_id } = ekskul;

      if (!nama_ekskul || !nama_ekskul.trim()) {
        return NextResponse.json({ error: 'Nama ekskul wajib diisi' }, { status: 400 });
      }
      if (!kelas_id) {
        return NextResponse.json({ error: 'Kelas wajib dipilih' }, { status: 400 });
      }

      // Verify kelas belongs to this school
      const kelasCheck = await query(
        'SELECT id FROM classes WHERE id = $1 AND school_id = $2',
        [kelas_id, schoolId]
      );
      if (!kelasCheck.rows[0]) {
        return NextResponse.json({ error: 'Kelas tidak valid' }, { status: 400 });
      }

      if (id) {
        const res = await query(
          `UPDATE ekstrakurikuler SET nama_ekskul = $1, kelas_id = $2,
           pembina_user_id = $3 WHERE id = $4 RETURNING *`,
          [nama_ekskul.trim(), kelas_id, userId, id]
        );
        if (!res.rows[0]) {
          return NextResponse.json({ error: 'Ekstrakurikuler tidak ditemukan' }, { status: 404 });
        }
        return NextResponse.json({ data: res.rows[0] });
      } else {
        const res = await query(
          `INSERT INTO ekstrakurikuler (nama_ekskul, kelas_id, pembina_user_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [nama_ekskul.trim(), kelas_id, userId]
        );
        return NextResponse.json({ data: res.rows[0] }, { status: 201 });
      }
    }

    if (action === 'deleteEkskul') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
      }
      // Verify ownership before delete
      const check = await query(
        'SELECT id FROM ekstrakurikuler WHERE id = $1 AND pembina_user_id = $2',
        [id, userId]
      );
      if (!check.rows[0]) {
        return NextResponse.json({ error: 'Ekstrakurikuler tidak ditemukan atau bukan milik Anda' }, { status: 404 });
      }
      await query('DELETE FROM ekstrakurikuler WHERE id = $1', [id]);
      return NextResponse.json({ success: true });
    }

    if (action === 'deleteKelas') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
      }
      const check = await query(
        'SELECT id FROM classes WHERE id = $1 AND school_id = $2',
        [id, schoolId]
      );
      if (!check.rows[0]) {
        return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
      }
      await query('DELETE FROM classes WHERE id = $1', [id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('POST /api/master-data error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
