import { query } from '@/lib/db';
import { sendWhatsAppNotification, sendEmailNotification } from '@/lib/notifications';

export async function approveSchoolRegistration(registration: any) {
  const npsn = registration.npsn ? registration.npsn.trim() : null;

  let mappedJenjang = 'Lainnya';
  const jenjangLower = (registration.jenjang || '').toLowerCase();
  if (jenjangLower.includes('sd')) mappedJenjang = 'SD';
  else if (jenjangLower.includes('mi')) mappedJenjang = 'MI';
  else if (jenjangLower.includes('smp')) mappedJenjang = 'SMP';
  else if (jenjangLower.includes('mts')) mappedJenjang = 'MTs';
  else if (jenjangLower.includes('sma')) mappedJenjang = 'SMA';
  else if (jenjangLower.includes('ma')) mappedJenjang = 'MA';
  else if (jenjangLower.includes('smk')) mappedJenjang = 'SMK';
  else if (jenjangLower.includes('pesantren')) mappedJenjang = 'Pesantren';

  let mappedNaungan = 'Swasta_Lainnya';
  const naunganLower = (registration.naungan || '').toLowerCase();
  if (naunganLower.includes('kemenag')) mappedNaungan = 'Kemenag';
  else if (naunganLower.includes('kemendikbud')) mappedNaungan = 'Kemendikbud';

  const activeYearRow = await query(`SELECT nama FROM tahun_ajaran WHERE is_active = true ORDER BY created_at DESC LIMIT 1`);
  const activeYear = activeYearRow.rows.length > 0 ? activeYearRow.rows[0].nama : '2025/2026';

  const newInstitution = await query(
    `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, subscription_tier, academic_year_active, approval_layer_config, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     RETURNING *`,
    [registration.nama_lembaga, npsn, mappedJenjang, mappedNaungan, 'trial', activeYear, 'single', 'active']
  );

  let school = null;
  if (npsn) {
    const existingSchool = await query('SELECT id FROM schools WHERE npsn = $1 LIMIT 1', [npsn]);
    if (existingSchool.rows.length === 0) {
      const newSchool = await query(
        `INSERT INTO schools (user_id, nama_sekolah, npsn, alamat, nama_kepala_sekolah)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [null, registration.nama_lembaga, npsn, registration.alamat || null, registration.nama_kepala_sekolah || null]
      );
      school = newSchool.rows[0];
    } else {
      school = existingSchool.rows[0];
    }
  } else {
    const newSchool = await query(
      `INSERT INTO schools (user_id, nama_sekolah, alamat, nama_kepala_sekolah)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [null, registration.nama_lembaga, registration.alamat || null, registration.nama_kepala_sekolah || null]
    );
    school = newSchool.rows[0];
  }

  let cmsUserId: number | null = null;
  if (registration.email_kontak) {
    const cmsUserResult = await query(`SELECT id FROM payload.cms_users WHERE email = $1 LIMIT 1`, [registration.email_kontak]);
    if (cmsUserResult.rows.length > 0) {
      cmsUserId = cmsUserResult.rows[0].id;
    } else {
      const newCms = await query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at, created_at, updated_at)
         VALUES ($1, $2, 'admin', '', '', true, '1.0', NOW(), NOW(), NOW())
         RETURNING id`,
        [registration.nama_lembaga || registration.email_kontak, registration.email_kontak]
      );
      cmsUserId = newCms.rows[0].id;
    }
  }

  const newInstitutionId = newInstitution.rows[0].id;

  if (cmsUserId) {
    const existingMembership = await query(
      `SELECT id FROM payload.institution_members WHERE user_id = $1 AND institution_id = $2 LIMIT 1`,
      [cmsUserId, newInstitutionId]
    );

    if (existingMembership.rows.length === 0) {
      const membership = await query(
        `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
         RETURNING id`,
        [cmsUserId, null, newInstitutionId]
      );

      await query(
        `INSERT INTO institution_members_role ("order", parent_id, value)
         VALUES ($1, $2, 'admin_sekolah')
         ON CONFLICT DO NOTHING`,
        [1, membership.rows[0].id]
      );
    }
  }

  if (school) {
    await query(`UPDATE users SET nama_sekolah = $1 WHERE email = $2`, [registration.nama_lembaga, registration.email_kontak]);
  }

  if (npsn) {
    try {
      const teachersResult = await query(
        `SELECT DISTINCT usa.userId, u.email, u.nama_lengkap, u.whatsapp
         FROM user_school_assignments usa
         JOIN schools s ON s.id = usa."schoolId"
         JOIN users u ON u.id = usa.userId
         WHERE s.npsn = $1
           AND NOT EXISTS (
             SELECT 1 FROM payload.institution_members im
             WHERE im.app_user_id = usa.userId
               AND im.institution_id = $2
           )`,
        [npsn, newInstitutionId]
      );

      const institutionName = registration.nama_lembaga;

      for (const teacher of teachersResult.rows) {
        const cmsResult = await query(`SELECT id FROM payload.cms_users WHERE email = $1 LIMIT 1`, [teacher.email]);

        let cmsTeacherId: number;
        if (cmsResult.rows.length > 0) {
          cmsTeacherId = cmsResult.rows[0].id;
        } else {
          const newCms = await query(
            `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at, created_at, updated_at)
             VALUES ($1, $2, 'admin', '', '', true, '1.0', NOW(), NOW(), NOW())
             RETURNING id`,
            [teacher.nama_lengkap || teacher.email, teacher.email]
          );
          cmsTeacherId = newCms.rows[0].id;
        }

        const member = await query(
          `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'invited', NULL, NOW(), NOW())
           RETURNING id`,
          [cmsTeacherId, teacher.userId, newInstitutionId]
        );

        await query(
          `INSERT INTO institution_members_role ("order", parent_id, value)
           VALUES ($1, $2, 'guru')
           ON CONFLICT DO NOTHING`,
          [1, member.rows[0].id]
        );

        const invitationToken =
          'inst_inv_' +
          Buffer.from(`${teacher.userId}:${newInstitutionId}:${Date.now()}`)
            .toString('base64url')
            .substring(0, 32);

        await query(`UPDATE users SET pending_invitation_token = $1 WHERE id = $2`, [invitationToken, teacher.userId]);

        const acceptUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/institution-invitation/accept?token=${invitationToken}`;

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
    institutionId: newInstitutionId,
    school,
  };
}
