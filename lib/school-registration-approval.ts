import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { randomBytes } from 'crypto';
import { sendWhatsAppNotification, sendEmailNotification } from '@/lib/notifications';
import {
  findOrCreateCmsUser,
  createMembership,
} from '@/lib/institution-members';

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  );
}

function mapJenjang(jenjang?: string) {
  const lower = (jenjang || '').toLowerCase();
  if (lower.includes('sd')) return 'SD';
  if (lower.includes('mi')) return 'MI';
  if (lower.includes('smp')) return 'SMP';
  if (lower.includes('mts')) return 'MTs';
  if (lower.includes('sma')) return 'SMA';
  if (lower.includes('ma')) return 'MA';
  if (lower.includes('smk')) return 'SMK';
  if (lower.includes('pesantren')) return 'Pesantren';
  return 'Lainnya';
}

function mapNaungan(naungan?: string) {
  const lower = (naungan || '').toLowerCase();
  if (lower.includes('kemenag')) return 'Kemenag';
  if (lower.includes('kemendikbud')) return 'Kemendikbud';
  return 'Swasta Lainnya';
}

async function ensureSchool(registration: any, npsn: string | null, userId: string) {
  if (npsn) {
    const existingSchool = await query('SELECT id FROM schools WHERE npsn = $1 LIMIT 1', [npsn]);
    if (existingSchool.rows.length > 0) return existingSchool.rows[0];
    const newSchool = await query(
      `INSERT INTO schools (user_id, nama_sekolah, npsn, alamat, nama_kepala_sekolah)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, registration.nama_lembaga, npsn, registration.alamat || null, registration.nama_kepala_sekolah || null]
    );
    return newSchool.rows[0];
  }
  const newSchool = await query(
    `INSERT INTO schools (user_id, nama_sekolah, alamat, nama_kepala_sekolah)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, registration.nama_lembaga, registration.alamat || null, registration.nama_kepala_sekolah || null]
  );
  return newSchool.rows[0];
}

async function resolveAppUser(registration: any): Promise<{ appUserId: string; isNew: boolean }> {
  if (!registration.email_kontak) {
    throw new Error('email_kontak wajib diisi');
  }
  const existingUser = await query(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [registration.email_kontak]
  );
  if (existingUser.rows.length > 0) {
    const appUserId = String(existingUser.rows[0].id);
    await query(
      `UPDATE users SET nama_sekolah = COALESCE(nama_sekolah, $1) WHERE id = $2`,
      [registration.nama_lembaga, appUserId]
    );
    return { appUserId, isNew: false };
  }

  // Buat akun dengan password hash acak (tidak bisa login ditebak);
  // pemilik mengatur kata sandi sendiri lewat "Lupa Kata Sandi" (OTP).
  const dummySecret = randomBytes(24).toString('hex');
  const hashed = await hashPassword(dummySecret);
  const newUser = await query(
    `INSERT INTO users (email, whatsapp, nama_lengkap, role, password_hash, status_langganan,
      subscription_status, subscription_start, subscription_end, is_active, account_type,
      pdp_consent_given, pdp_consent_version, email_verified, phone_verified, created_at)
     VALUES ($1, $2, $3, 'kepala_sekolah', $4, 'trial', 'active', NOW(), NOW() + INTERVAL '30 days',
       TRUE, 'institutional', TRUE, '1.0', FALSE, FALSE, NOW())
     RETURNING id`,
    [
      registration.email_kontak,
      registration.whatsapp || null,
      registration.nama_kepala_sekolah || registration.nama_lembaga,
      hashed,
    ]
  );
  return { appUserId: String(newUser.rows[0].id), isNew: true };
}

export async function approveSchoolRegistration(registration: any) {
  const npsn = registration.npsn ? String(registration.npsn).trim() : null;
  const jenjang = mapJenjang(registration.jenjang);
  const naungan = mapNaungan(registration.naungan);

  const activeYearRow = await query(
    `SELECT nama FROM tahun_ajaran WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
  );
  const activeYear = activeYearRow.rows.length > 0 ? activeYearRow.rows[0].nama : '2025/2026';

  // ── Akun app (public.users) dahulu: jadi pemilik & user_id untuk schools ──
  const { appUserId } = await resolveAppUser(registration);

  // ── Sekolah (dibuat dahulu karena public.institutions.school_id NOT NULL) ──
  const school = await ensureSchool(registration, npsn, appUserId);

  // ── DEDUP: jangan buat institusi ganda untuk npsn/email yang sama ──
  let publicInstId: number | null = null; // universe yang dipakai app/dashboard
  let payloadInstId: number | null = null; // mirror untuk Payload/admin

  if (npsn) {
    const byNpsn = await query(
      `SELECT id FROM public.institutions WHERE npsn = $1 LIMIT 1`,
      [npsn]
    );
    if (byNpsn.rows.length > 0) publicInstId = byNpsn.rows[0].id;

    const byNpsnPayload = await query(
      `SELECT id FROM payload.institutions WHERE npsn = $1 LIMIT 1`,
      [npsn]
    );
    if (byNpsnPayload.rows.length > 0) payloadInstId = byNpsnPayload.rows[0].id;
  }

  if (!publicInstId && registration.email_kontak) {
    const byEmail = await query(
      `SELECT DISTINCT im.institution_id AS id
       FROM payload.cms_users cu
       JOIN public.institution_members im ON im.user_id = cu.id
       WHERE LOWER(cu.email) = LOWER($1) AND im.status = 'active'
       LIMIT 1`,
      [registration.email_kontak]
    );
    if (byEmail.rows.length > 0) publicInstId = byEmail.rows[0].id;
  }

  const institutionValues = [
    registration.nama_lembaga,
    npsn,
    jenjang,
    naungan,
    'trial',
    activeYear,
    'single',
    'active',
  ];

  if (!publicInstId) {
    const newInst = await query(
      `INSERT INTO public.institutions (name, npsn, jenjang, naungan, subscription_tier, academic_year_active, approval_layer_config, status, school_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id`,
      [...institutionValues, school.id]
    );
    publicInstId = newInst.rows[0].id;
  } else if (school && publicInstId) {
    await query(
      `UPDATE public.institutions SET school_id = $1 WHERE id = $2`,
      [school.id, publicInstId]
    );
  }

  if (!payloadInstId) {
    const newPayload = await query(
      `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, subscription_tier, academic_year_active, approval_layer_config, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      institutionValues
    );
    payloadInstId = newPayload.rows[0].id;
  }

  if (publicInstId == null) {
    throw new Error('Gagal membuat institusi');
  }

  // ── cms user (Payload) untuk CMS/admin ──
  const appUser = {
    id: appUserId,
    email: registration.email_kontak,
    nama_lengkap: registration.nama_kepala_sekolah || registration.nama_lembaga,
  };
  const cmsUserId = await findOrCreateCmsUser(appUser);

  // ── Membership aktif + role admin_sekolah (yang dipakai app) ──
  const existingMember = await query(
    `SELECT id FROM public.institution_members
     WHERE institution_id = $1 AND (app_user_id = $2 OR user_id = $3)
     LIMIT 1`,
    [publicInstId, appUserId, cmsUserId]
  );

  let memberId: number;
  if (existingMember.rows.length === 0) {
    const member = await createMembership(appUserId, cmsUserId, publicInstId, 'active');
    memberId = member.id;
  } else {
    memberId = existingMember.rows[0].id;
    await query(
      `UPDATE public.institution_members
       SET status = 'active', joined_at = COALESCE(joined_at, NOW()),
           app_user_id = COALESCE(app_user_id, $1), updated_at = NOW()
       WHERE id = $2`,
      [appUserId, memberId]
    );
  }

  await query(
    `INSERT INTO public.institution_members_role (parent_id, value)
     VALUES ($1, 'admin_sekolah')
     ON CONFLICT DO NOTHING`,
    [memberId]
  );

  // ── Auto-undang guru dengan NPSN yang sama ──
  if (npsn && publicInstId) {
    try {
      const teachersResult = await query(
        `SELECT DISTINCT usa."userId", u.email, u.nama_lengkap, u.whatsapp
         FROM user_school_assignments usa
         JOIN schools s ON s.id = usa."schoolId"::uuid
         JOIN users u ON u.id = usa."userId"::uuid
         WHERE s.npsn = $1
           AND NOT EXISTS (
             SELECT 1 FROM public.institution_members im
             WHERE im.app_user_id = usa."userId"::text
               AND im.institution_id = $2
           )`,
        [npsn, publicInstId]
      );

      const institutionName = registration.nama_lembaga;

      for (const teacher of teachersResult.rows) {
        const teacherCmsId = await findOrCreateCmsUser(teacher);

        const member = await query(
          `INSERT INTO public.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'invited', NULL, NOW(), NOW())
           RETURNING id`,
          [teacherCmsId, teacher.userId, publicInstId]
        );

        await query(
          `INSERT INTO public.institution_members_role (parent_id, value)
           VALUES ($1, 'guru')
           ON CONFLICT DO NOTHING`,
          [member.rows[0].id]
        );

        const invitationToken =
          'inst_inv_' +
          Buffer.from(`${teacher.userId}:${publicInstId}:${Date.now()}`)
            .toString('base64url')
            .substring(0, 32);

        await query(
          `UPDATE users SET pending_invitation_token = $1 WHERE id = $2`,
          [invitationToken, teacher.userId]
        );

        const acceptUrl = `${baseUrl()}/institution-invitation/accept?token=${invitationToken}`;

        const waMessage = `[GuruPRO] Undangan Bergabung Institusi

Halo ${teacher.nama_lengkap || 'Bapak/Ibu'},

Anda diundang untuk bergabung dengan institusi "${institutionName}" di GuruPRO.

Klik tautan berikut untuk menerima undangan:
${acceptUrl}

Terima kasih,
Tim GuruPRO`;

        const emailSubject = `Undangan Bergabung - ${institutionName}`;
        const emailHtml = `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #4f46e5;">Undangan Bergabung Institusi</h2>
          <p>Halo <strong>${teacher.nama_lengkap || 'Bapak/Ibu'}</strong>,</p>
          <p>Anda diundang untuk bergabung dengan institusi <strong>${institutionName}</strong>.</p>
          <p><a href="${acceptUrl}">Klik di sini untuk menerima undangan</a></p>
          <p>Terima kasih,<br>Tim GuruPRO</p>
        </div>`;

        try {
          if (teacher.whatsapp) await sendWhatsAppNotification(teacher.whatsapp, waMessage);
          if (teacher.email) await sendEmailNotification(teacher.email, emailSubject, emailHtml);
        } catch { /* non-critical */ }
      }
    } catch (e) {
      console.error('Auto-invite teachers error:', e);
    }
  }

  return {
    institutionId: publicInstId,
    payloadInstitutionId: payloadInstId,
    school,
  };
}