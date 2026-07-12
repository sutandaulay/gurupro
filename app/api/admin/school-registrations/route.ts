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

// GET: Ambil semua pendaftaran
export async function GET() {
  try {
    await requireAdmin();

    const registrations = await prisma.school_registrations.findMany({
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(registrations);
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
    const currentRegistration = await prisma.school_registrations.findUnique({
      where: { id },
    });

    if (!currentRegistration) {
      return NextResponse.json({ error: 'Data pendaftaran tidak ditemukan' }, { status: 404 });
    }

    // Update status pendaftaran
    const updated = await prisma.school_registrations.update({
      where: { id },
      data: {
        status,
        catatan_admin: catatan_admin || null,
      },
    });

    // Jika status diubah menjadi approved, buat lembaga (institution) baru secara otomatis
    if (status === 'approved') {
      const npsn = currentRegistration.npsn ? currentRegistration.npsn.trim() : null;

      // Cek apakah institusi dengan NPSN yang sama sudah ada
      let existingInstitution = null;
      if (npsn) {
        existingInstitution = await prisma.institutions.findFirst({
          where: { npsn },
        });
      }

      if (!existingInstitution) {
        // Pemetaan jenjang ke enum enum_institutions_jenjang
        let mappedJenjang: any = 'Lainnya';
        const jenjangLower = currentRegistration.jenjang.toLowerCase();
        if (jenjangLower.includes('sd')) {
          mappedJenjang = 'SD';
        } else if (jenjangLower.includes('mi')) {
          mappedJenjang = 'MI';
        } else if (jenjangLower.includes('smp')) {
          mappedJenjang = 'SMP';
        } else if (jenjangLower.includes('mts')) {
          mappedJenjang = 'MTs';
        } else if (jenjangLower.includes('sma')) {
          mappedJenjang = 'SMA';
        } else if (jenjangLower.includes('ma')) {
          mappedJenjang = 'MA';
        } else if (jenjangLower.includes('smk')) {
          mappedJenjang = 'SMK';
        } else if (jenjangLower.includes('pesantren')) {
          mappedJenjang = 'Pesantren';
        }

        // Pemetaan naungan ke enum enum_institutions_naungan
        let mappedNaungan: any = 'Swasta_Lainnya';
        const naunganLower = currentRegistration.naungan.toLowerCase();
        if (naunganLower.includes('kemenag')) {
          mappedNaungan = 'Kemenag';
        } else if (naunganLower.includes('kemendikbud')) {
          mappedNaungan = 'Kemendikbud';
        }

        // Ambil tahun ajaran aktif dari database secara dinamis
        const activeTahunAjaran = await prisma.tahun_ajaran.findFirst({
          where: { is_active: true },
          select: { nama: true },
        });
        const activeYear = activeTahunAjaran?.nama || '2025/2026';

        // Buat institusi baru
        await prisma.institutions.create({
          data: {
            name: currentRegistration.nama_lembaga,
            npsn: npsn || null,
            jenjang: mappedJenjang,
            naungan: mappedNaungan,
            subscription_tier: 'trial',
            academic_year_active: activeYear, // Menggunakan tahun ajaran aktif dinamis
            approval_layer_config: 'single',
            status: 'active', // Set aktif agar bisa langsung digunakan
          },
        });

        // Buat sekolah baru di tabel schools utama (jika belum ada berdasarkan NPSN)
        if (npsn) {
          const existingSchool = await prisma.schools.findFirst({
            where: { npsn },
          });

          if (!existingSchool) {
            await prisma.schools.create({
              data: {
                user_id: userId, // Dihubungkan ke admin yang memproses
                nama_sekolah: currentRegistration.nama_lembaga,
                npsn: npsn,
                alamat: currentRegistration.alamat || null,
                nama_kepala_sekolah: currentRegistration.nama_kepala_sekolah || null,
              },
            });
          }
        } else {
          // Jika NPSN kosong, buat sekolah baru saja berdasarkan nama
          await prisma.schools.create({
            data: {
              user_id: userId,
              nama_sekolah: currentRegistration.nama_lembaga,
              alamat: currentRegistration.alamat || null,
              nama_kepala_sekolah: currentRegistration.nama_kepala_sekolah || null,
            },
          });
        }
      }
    }

    return NextResponse.json(updated);
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

    await prisma.school_registrations.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
