import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const prisma = new PrismaClient();

// Helper: Pastikan user adalah admin
async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');

  const session = JSON.parse(sessionCookie);
  const userId = session.id;

  const result = await query('SELECT role FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
    throw new Error('Forbidden');
  }

  return userId;
}

export async function GET() {
  try {
    await requireAdmin();

    const activeTahunAjaran = await prisma.tahun_ajaran.findFirst({
      where: { is_active: true },
      select: { nama: true },
    });

    return NextResponse.json({
      active_academic_year: activeTahunAjaran?.nama || '2025/2026',
    });
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
