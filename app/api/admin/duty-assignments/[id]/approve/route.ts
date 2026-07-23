import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { query } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { action } = body; // 'approve' or 'reject'

    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;

    if (!status) {
      return NextResponse.json({ error: 'Action harus approve atau reject' }, { status: 400 });
    }

    const adminId = await requireAdmin();

    const result = await query(
      `UPDATE duty_assignments 
       SET status = $1, approved_by = $2 
       WHERE id = $3 
       RETURNING id, status, approved_by`,
      [status, adminId, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Approve duty assignment error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const result = await query(
      `SELECT 
        da.*,
        u.nama_lengkap as teacher_name,
        u.email as teacher_email
       FROM duty_assignments da
       LEFT JOIN users u ON da.teacher_id = u.id
       WHERE da.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Get duty assignment detail error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
