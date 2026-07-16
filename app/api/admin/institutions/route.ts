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

    // Mengambil institusi dan menghitung jumlah member
    const institutions = await prisma.institutions.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { npsn: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: { institution_members: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(institutions);
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

    const newInstitution = await prisma.institutions.create({
      data: {
        name,
        npsn: npsn || null,
        jenjang,
        naungan,
        subscription_tier: subscription_tier || 'trial',
        academic_year_active: academic_year_active || null,
        approval_layer_config: approval_layer_config || 'single',
        status: status || 'trial',
      },
    });

    // Buat sekolah baru di tabel schools utama (jika belum ada berdasarkan NPSN)
    const cleanNpsn = npsn ? npsn.trim() : null;
    if (cleanNpsn) {
      const existingSchool = await prisma.schools.findFirst({
        where: { npsn: cleanNpsn },
      });

      if (!existingSchool) {
        await prisma.schools.create({
          data: {
            user_id: userId,
            nama_sekolah: name,
            npsn: cleanNpsn,
          },
        });
      }
    } else {
      // Jika NPSN kosong, buat sekolah baru berdasarkan nama
      await prisma.schools.create({
        data: {
          user_id: userId,
          nama_sekolah: name,
        },
      });
    }

    return NextResponse.json(newInstitution, { status: 201 });
  } catch (error: any) {
    console.error('Create institution error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    
    // Cek unique constraint error (P2002) untuk NPSN
    if (error.code === 'P2002') {
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

    const updated = await prisma.institutions.update({
      where: { id: Number(id) },
      data: {
        name,
        npsn: npsn || null,
        jenjang,
        naungan,
        subscription_tier,
        academic_year_active,
        approval_layer_config,
        status,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update institution error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;

    if (error.code === 'P2002') {
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

    await prisma.institutions.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete institution error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
