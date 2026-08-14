import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { parseSessionCookie } from '@/lib/session-sign';

const prisma = new PrismaClient();

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
                 FROM public.institution_members_role imr WHERE imr.parent_id = im.id),
                '[]'::json
              ) AS roles
       FROM public.institution_members im
       JOIN cms_users cu ON cu.id = im.user_id
       LEFT JOIN users u ON u.id::text = im.app_user_id
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
    let cmsUser = await query(
      `SELECT id, name, email FROM payload.cms_users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    if (cmsUser.rows.length === 0) {
      const newCmsUser = await query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at, created_at, updated_at)
         VALUES ($1, $2, 'admin', '', '', true, '1.0', NOW(), NOW(), NOW())
         RETURNING id`,
        [name, email.toLowerCase().trim()]
      );
      cmsUser = { rows: [{ id: newCmsUser.rows[0].id }] } as any;
    }
    const cmsUserId = cmsUser.rows[0].id;

    // 3. Cek apakah sudah terdaftar sebagai anggota di lembaga ini
    const existingMembership = await query(
      `SELECT id FROM public.institution_members WHERE user_id = $1 AND institution_id = $2 LIMIT 1`,
      [cmsUserId, instId]
    );

    if (existingMembership.rows.length > 0) {
      return NextResponse.json({ error: 'Pengguna ini sudah terdaftar sebagai anggota di lembaga ini' }, { status: 409 });
    }

    // 4. Buat keanggotaan (institution_members) dengan status active
    const membershipRes = await query(
      `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
       RETURNING id`,
      [cmsUserId, appUser.id, instId]
    );
    const membershipId = membershipRes.rows[0].id;

    // 5. Tambahkan role keanggotaan (institution_members_role)
    await query(
      `INSERT INTO payload.institution_members_role ("order", parent_id, value)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [1, membershipId, role]
    );

    // 6. Sinkronkan sekolah dan buat user_school_assignments otomatis
    const institutionRes = await query(
      `SELECT id, name, npsn FROM payload.institutions WHERE id = $1 LIMIT 1`,
      [instId]
    );
    const institution = institutionRes.rows[0];

    if (institution) {
      // Perbarui nama_sekolah di tabel users utama milik user tersebut
      await prisma.users.update({
        where: { id: appUser.id },
        data: { nama_sekolah: institution.name },
      });

      // Cari sekolah di tabel schools utama berdasarkan NPSN atau Nama
      let school = null;
      if (institution.npsn) {
        const schoolByNpsn = await prisma.schools.findFirst({
          where: { npsn: institution.npsn },
        });
        if (schoolByNpsn) school = schoolByNpsn;
      }

      if (!school) {
        const schoolByName = await prisma.schools.findFirst({
          where: { nama_sekolah: institution.name },
        });
        if (schoolByName) school = schoolByName;
      }

      // Jika sekolah tidak ditemukan, buat entri sekolah baru otomatis
      if (!school) {
        school = await prisma.schools.create({
          data: {
            user_id: appUser.id,
            nama_sekolah: institution.name,
            npsn: institution.npsn || null,
          },
        });
      }

      // Hubungkan user dengan sekolah di user_school_assignments jika belum terhubung
      if (school) {
        const existingAssignment = await prisma.user_school_assignments.findFirst({
          where: {
            userId: appUser.id,
            schoolId: school.id,
          },
        });

        if (!existingAssignment) {
          await prisma.user_school_assignments.create({
            data: {
              userId: appUser.id,
              schoolId: school.id,
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
