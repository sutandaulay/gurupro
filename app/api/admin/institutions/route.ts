import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseSessionCookie } from '@/lib/session-sign';

// Helper: Pastikan user adalah admin
async function requireAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
  if (!session) throw new Error('Unauthorized');

  const userId = session.id;

  const result = await query('SELECT role FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0 || !['admin', 'super_admin', 'manager'].includes(result.rows[0].role)) {
    throw new Error('Forbidden');
  }

  return userId;
}

// GET: Ambil daftar lembaga
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    // source=all → gabungkan public.institutions (operasional/konteks user)
    // dengan payload.institutions (kelola admin). Default hanya payload.
    const source = searchParams.get('source') || 'payload';

    let institutionsQuery: string;
    const params: any[] = [];

    if (source === 'all') {
      // Prefer data public.institutions saat id bentrok (public menang).
      // DISTINCT ON + ORDER BY harus diawali kolom id.
      institutionsQuery = `
        SELECT id, name, npsn, jenjang, naungan, subscription_tier,
               academic_year_active, approval_layer_config, status,
               created_at, updated_at, member_count
        FROM (
          SELECT DISTINCT ON (i.id)
                 i.id, i.name, i.npsn, i.jenjang, i.naungan,
                 i.subscription_tier, i.academic_year_active,
                 i.approval_layer_config, i.status, i.created_at, i.updated_at,
                 (SELECT COUNT(*) FROM public.institution_members im
                  WHERE im.institution_id = i.id AND im.status = 'active') AS member_count
          FROM (
            SELECT id, name::text AS name, npsn, jenjang::text AS jenjang,
                   naungan::text AS naungan, subscription_tier::text AS subscription_tier,
                   academic_year_active, approval_layer_config::text AS approval_layer_config,
                   status::text AS status, created_at, updated_at,
                   'public' AS source
            FROM public.institutions
            UNION ALL
            SELECT id, name::text AS name, npsn, jenjang::text AS jenjang,
                   naungan::text AS naungan, subscription_tier::text AS subscription_tier,
                   academic_year_active, approval_layer_config::text AS approval_layer_config,
                   status::text AS status, created_at, updated_at,
                   'payload' AS source
            FROM payload.institutions
          ) i
          ORDER BY i.id, CASE WHEN i.source = 'public' THEN 0 ELSE 1 END
        ) f
      `;
    } else {
      institutionsQuery = `
        SELECT i.*,
          (SELECT COUNT(*) FROM public.institution_members im WHERE im.institution_id = i.id AND im.status = 'active') as member_count
        FROM payload.institutions i
      `;
    }

    if (search) {
      institutionsQuery += ` WHERE LOWER(f.name) LIKE $1 OR LOWER(COALESCE(f.npsn, '')) LIKE $1`;
      params.push(`%${search.toLowerCase()}%`);
    }

    institutionsQuery += ` ORDER BY f.created_at DESC`;

    const institutions = await query(institutionsQuery, params);

    return NextResponse.json(institutions.rows);
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

// POST: Buat lembaga baru
export async function POST(req: Request) {
  try {
    const userId = await requireAdmin();

    const body = await req.json();
    const { name, npsn, jenjang, naungan, subscription_tier, academic_year_active, approval_layer_config, status } = body;

    if (!name || !jenjang || !naungan) {
      return NextResponse.json({ error: 'Nama, jenjang, dan naungan wajib diisi' }, { status: 400 });
    }

    const cleanNpsn = npsn ? npsn.trim() : null;

    const newInstitution = await query(
      `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, subscription_tier, academic_year_active, approval_layer_config, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [name, cleanNpsn, jenjang, naungan, subscription_tier || 'trial', academic_year_active || null, approval_layer_config || 'single', status || 'trial']
    );

    // Buat sekolah baru di tabel schools utama (jika belum ada berdasarkan NPSN)
    if (cleanNpsn) {
      const existingSchool = await query(
        'SELECT id FROM schools WHERE npsn = $1 LIMIT 1',
        [cleanNpsn]
      );

      if (existingSchool.rows.length === 0) {
        await query(
          'INSERT INTO schools (user_id, nama_sekolah, npsn) VALUES ($1, $2, $3)',
          [userId, name, cleanNpsn]
        );
      }
    } else {
      await query(
        'INSERT INTO schools (user_id, nama_sekolah) VALUES ($1, $2)',
        [userId, name]
      );
    }

    return NextResponse.json(newInstitution.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Create institution error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;

    if (error.code === 'P2002' || error.message?.includes('unique constraint')) {
      return NextResponse.json({ error: 'NPSN sudah digunakan oleh lembaga lain' }, { status: 409 });
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

// PUT: Perbarui data lembaga
export async function PUT(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id, name, npsn, jenjang, naungan, subscription_tier, academic_year_active, approval_layer_config, status } = body;

    if (!id || !name || !jenjang || !naungan) {
      return NextResponse.json({ error: 'ID, nama, jenjang, dan naungan wajib diisi' }, { status: 400 });
    }

    const updated = await query(
      `UPDATE payload.institutions
       SET name = $1, npsn = $2, jenjang = $3, naungan = $4, subscription_tier = $5, academic_year_active = $6, approval_layer_config = $7, status = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, npsn || null, jenjang, naungan, subscription_tier, academic_year_active, approval_layer_config, status, Number(id)]
    );

    if (updated.rows.length === 0) {
      return NextResponse.json({ error: 'Lembaga tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(updated.rows[0]);
  } catch (error: any) {
    console.error('Update institution error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;

    if (error.code === 'P2002' || error.message?.includes('unique constraint')) {
      return NextResponse.json({ error: 'NPSN sudah digunakan oleh lembaga lain' }, { status: 409 });
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

// DELETE: Hapus lembaga
export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    const result = await query(
      'DELETE FROM payload.institutions WHERE id = $1 RETURNING id',
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Lembaga tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete institution error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
