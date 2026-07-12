import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

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

// GET: Ambil daftar anggota lembaga (Operator, Kepala Sekolah, dll)
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const instId = parseInt(id, 10);

    if (isNaN(instId)) {
      return NextResponse.json({ error: 'ID lembaga tidak valid' }, { status: 400 });
    }

    const members = await query(
      `SELECT im.id, im.user_id, im.app_user_id, im.status, im.created_at,
              cu.name AS name, cu.email AS email,
              u.whatsapp AS whatsapp,
              COALESCE(
                (SELECT json_agg(imr.value)
                 FROM institution_members_role imr WHERE imr.parent_id = im.id),
                '[]'::json
              ) AS roles
       FROM institution_members im
       JOIN cms_users cu ON cu.id = im.user_id
       LEFT JOIN users u ON u.id = im.app_user_id::uuid
       WHERE im.institution_id = $1
       ORDER BY im.created_at DESC`,
      [instId]
    );

    return NextResponse.json(members.rows);
  } catch (error: any) {
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}

// POST: Buat user baru (jika belum ada) + hubungkan sebagai anggota lembaga dengan role tertentu
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const instId = parseInt(id, 10);

    if (isNaN(instId)) {
      return NextResponse.json({ error: 'ID lembaga tidak valid' }, { status: 400 });
    }

    const body = await req.json();
    const { email, name, whatsapp, password, role } = body; // role: 'operator', 'kepala_sekolah', 'guru', dll

    if (!email || !name || !password || !role) {
      return NextResponse.json({ error: 'Email, Nama, Password, dan Peran (Role) wajib diisi' }, { status: 400 });
    }

    // 1. Cek atau Buat user di tabel users utama (untuk login aplikasi)
    let appUser = await prisma.users.findUnique({ where: { email } });
    const hashedPassword = await hashPassword(password);

    if (!appUser) {
      // Buat user baru
      const randomReferral = "GPRO-" + Math.random().toString(36).substring(2, 7).toUpperCase();
      appUser = await prisma.users.create({
        data: {
          email,
          nama_lengkap: name,
          whatsapp: whatsapp || '',
          password_hash: hashedPassword,
          role: 'guru', // role global default
          status_langganan: 'free',
          referral_code: randomReferral,
          is_active: true,
          username: email.split('@')[0] + Math.floor(100 + Math.random() * 900), // auto generate username unik
        },
      });
    }

    // 2. Cek atau Buat user di cms_users (Payload CMS layer)
    let cmsUser = await prisma.cms_users.findFirst({ where: { email } });
    if (!cmsUser) {
      cmsUser = await prisma.cms_users.create({
        data: {
          name,
          email,
          password: '', // payload password dikosongkan karena auth utama lewat users table
          role: 'editor',
          salt: '',
          hash: '',
        },
      });
    }

    // 3. Cek apakah sudah terdaftar sebagai anggota di lembaga ini
    const existingMembership = await prisma.institution_members.findFirst({
      where: {
        user_id: cmsUser.id,
        institution_id: instId,
      },
    });

    if (existingMembership) {
      return NextResponse.json({ error: 'Pengguna ini sudah terdaftar sebagai anggota di lembaga ini' }, { status: 409 });
    }

    // 4. Buat keanggotaan (institution_members) dengan status active
    const membership = await prisma.institution_members.create({
      data: {
        user_id: cmsUser.id,
        app_user_id: appUser.id,
        institution_id: instId,
        status: 'active',
        joined_at: new Date(),
      },
    });

    // 5. Tambahkan role keanggotaan (institution_members_role)
    await prisma.institution_members_role.create({
      data: {
        order: 1,
        parent_id: membership.id,
        value: role,
      },
    });

    // 6. Sinkronkan sekolah dan buat user_school_assignments otomatis
    const institution = await prisma.institutions.findUnique({
      where: { id: instId },
    });

    if (institution) {
      // Perbarui nama_sekolah di tabel users utama milik user tersebut
      await prisma.users.update({
        where: { id: appUser.id },
        data: { nama_sekolah: institution.name },
      });

      // Cari sekolah di tabel schools utama berdasarkan NPSN atau Nama
      let school = null;
      if (institution.npsn) {
        school = await prisma.schools.findFirst({
          where: { npsn: institution.npsn },
        });
      }

      if (!school) {
        school = await prisma.schools.findFirst({
          where: { nama_sekolah: institution.name },
        });
      }

      // Jika sekolah tidak ditemukan, buat entri sekolah baru otomatis
      if (!school) {
        school = await prisma.schools.create({
          data: {
            user_id: appUser.id, // Set pembuat pertama kali ke user ini
            nama_sekolah: institution.name,
            npsn: institution.npsn || null,
          },
        });
      }

      // Hubungkan user dengan sekolah di user_school_assignments jika belum terhubung
      if (school) {
        const existingAssignment = await prisma.user_school_assignments.findFirst({
          where: {
            userid: appUser.id,
            schoolid: school.id,
          },
        });

        if (!existingAssignment) {
          await prisma.user_school_assignments.create({
            data: {
              userid: appUser.id,
              schoolid: school.id,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil dibuat, disinkronkan ke sekolah utama, dan dihubungkan ke lembaga!',
      user: {
        email: appUser.email,
        name: appUser.nama_lengkap,
        role: role,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create institution member error:', error);
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
