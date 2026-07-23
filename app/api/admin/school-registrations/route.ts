import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { approveSchoolRegistration } from '@/lib/school-registration-approval';

// Helper: Pastikan user adalah admin
async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');

  const session = JSON.parse(sessionCookie);
  const userId = session.id;

  const result = await query('SELECT role FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0 || !['admin', 'super_admin', 'manager'].includes(result.rows[0].role)) {
    throw new Error('Forbidden');
  }

  return userId;
}

// GET: Ambil semua pendaftaran
export async function GET() {
  try {
    await requireAdmin();

    const registrations = await query(`
      SELECT id, nama_lembaga, npsn, jenjang, naungan, alamat, nama_kepala_sekolah, email_kontak, whatsapp, status, catatan_admin, created_at, updated_at
      FROM school_registrations
      ORDER BY created_at DESC
    `);

    return NextResponse.json(registrations.rows);
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// PUT: Update status & catatan admin
export async function PUT(req: Request) {
  try {
    const userId = await requireAdmin();

    const { id, status, catatan_admin } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'ID dan status wajib diisi' }, { status: 400 });
    }

    const validStatuses = ['pending', 'contacted', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
    }

    // Ambil data pendaftaran saat ini
    const currentRegistration = await query(
      'SELECT * FROM school_registrations WHERE id = $1 LIMIT 1',
      [id]
    );

    if (currentRegistration.rows.length === 0) {
      return NextResponse.json({ error: 'Data pendaftaran tidak ditemukan' }, { status: 404 });
    }

    const registration = currentRegistration.rows[0];

    // Update status pendaftaran
    await query(
      `UPDATE school_registrations
       SET status = $1, catatan_admin = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, catatan_admin || null, id]
    );

    // Jika status diubah menjadi approved, buat lembaga (institution) baru secara otomatis
    if (status === 'approved') {
      try {
        await approveSchoolRegistration(registration);
      } catch (e) {
        console.error('Error approving registration:', e);
        return NextResponse.json({ error: 'Gagal menyetujui pendaftaran' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    console.error('Update registration status error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

// DELETE: Hapus pendaftaran
export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    await query('DELETE FROM school_registrations WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
