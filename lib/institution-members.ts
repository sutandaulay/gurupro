import { query, pool } from '@/lib/db';

export type MembershipStatus = 'pending' | 'invited' | 'active' | 'left' | 'rejected';

export type ConnectionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ConnectionRequestRow {
  id: string;
  user_id: string;
  institution_id: number;
  school_id: string;
  status: ConnectionRequestStatus;
  rejected_until: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  user_whatsapp?: string;
  institution_name?: string;
}

export async function createConnectionRequest(
  userId: string,
  institutionId: number,
  schoolId: string
): Promise<ConnectionRequestRow> {
  const result = await query(
    `INSERT INTO connection_requests (user_id, institution_id, school_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'pending', NOW(), NOW())
     RETURNING *`,
    [userId, institutionId, schoolId]
  );
  return mapConnectionRequestRow(result.rows[0]);
}

export async function createPendingMembership(
  cmsUserId: number,
  appUserId: string,
  institutionId: number
): Promise<InstitutionMemberRow> {
  return createMembership(appUserId, cmsUserId, institutionId, 'pending');
}

export async function getPendingConnectionRequestsByInstitution(
  institutionId: number
): Promise<ConnectionRequestRow[]> {
  const result = await query(
    `SELECT cr.*, u.nama_lengkap as user_name, u.email as user_email, u.whatsapp as user_whatsapp,
            i.name as institution_name
     FROM connection_requests cr
     JOIN users u ON u.id = cr.user_id
     JOIN payload.institutions i ON i.id = cr.institution_id
     WHERE cr.institution_id = $1 AND cr.status = 'pending'
     ORDER BY cr.created_at DESC`,
    [institutionId]
  );
  return result.rows.map(mapConnectionRequestRow);
}

export async function approveConnectionRequest(
  requestId: string,
  cmsUserId: number | null,
  appUserId: string
): Promise<ConnectionRequestRow | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT * FROM connection_requests WHERE id = $1 AND status = 'pending' LIMIT 1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const request = requestResult.rows[0];

    await client.query(
      `UPDATE connection_requests SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [requestId]
    );

    let resolvedCmsUserId = cmsUserId;
    if (!resolvedCmsUserId) {
      const cmsResult = await client.query(
        `SELECT id FROM payload.cms_users WHERE email = (SELECT email FROM users WHERE id = $1) LIMIT 1`,
        [appUserId]
      );
      if (cmsResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      resolvedCmsUserId = cmsResult.rows[0].id;
    }

    const memberResult = await client.query(
      `SELECT id FROM public.institution_members WHERE user_id = $1 AND institution_id = $2 LIMIT 1`,
      [resolvedCmsUserId, request.institution_id]
    );

    let memberId = memberResult.rows[0]?.id;
    if (!memberId) {
      const newMember = await client.query(
        `INSERT INTO public.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
         RETURNING id`,
        [resolvedCmsUserId, appUserId, request.institution_id]
      );
      memberId = newMember.rows[0].id;
    } else {
      await client.query(
        `UPDATE public.institution_members SET status = 'active', updated_at = NOW(), app_user_id = COALESCE(app_user_id, $1)
         WHERE id = $2`,
        [appUserId, memberId]
      );
    }

    await client.query(
      `INSERT INTO public.institution_members_role (parent_id, value)
       VALUES ($1, 'guru')
       ON CONFLICT DO NOTHING`,
      [memberId]
    );

    const npsnResult = await client.query(
      `SELECT npsn FROM payload.institutions WHERE id = $1 LIMIT 1`,
      [request.institution_id]
    );

    if (npsnResult.rows.length > 0 && npsnResult.rows[0].npsn) {
      const schoolResult = await client.query(
        `SELECT id FROM schools WHERE npsn = $1 LIMIT 1`,
        [npsnResult.rows[0].npsn]
      );

      if (schoolResult.rows.length > 0) {
        const existingAssign = await client.query(
          `SELECT id FROM user_school_assignments WHERE userid = $1 AND schoolid = $2 LIMIT 1`,
          [appUserId, schoolResult.rows[0].id]
        );

        if (existingAssign.rows.length === 0) {
          await client.query(
            `INSERT INTO user_school_assignments (userid, schoolid, tahunajaranid, iswalikelas)
             VALUES ($1, $2, NULL, false)
             ON CONFLICT DO NOTHING`,
            [appUserId, schoolResult.rows[0].id]
          );
        }
      }
    }

    await client.query(`UPDATE users SET nama_sekolah = COALESCE(nama_sekolah, $1) WHERE id = $2`, [
      request.institution_name,
      appUserId,
    ]);

    await client.query('COMMIT');
    return mapConnectionRequestRow({ ...request, status: 'approved' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve connection request error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectConnectionRequest(
  requestId: string,
  rejectedUntil?: Date
): Promise<ConnectionRequestRow | null> {
  const result = await query(
    `UPDATE connection_requests
     SET status = 'rejected',
         rejected_until = COALESCE($2, rejected_until),
         updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [requestId, rejectedUntil ? new Date(rejectedUntil).toISOString() : null]
  );
  if (result.rows.length === 0) return null;
  return mapConnectionRequestRow(result.rows[0]);
}

export async function countPendingConnectionRequestsByUser(userId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM connection_requests WHERE user_id = $1 AND status = 'pending'`,
    [userId]
  );
  return result.rows[0]?.count || 0;
}

function mapConnectionRequestRow(row: any): ConnectionRequestRow {
  return {
    id: row.id,
    user_id: row.user_id,
    institution_id: Number(row.institution_id),
    school_id: row.school_id,
    status: row.status,
    rejected_until: row.rejected_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_name: row.user_name,
    user_email: row.user_email,
    user_whatsapp: row.user_whatsapp,
    institution_name: row.institution_name,
  };
}

export type AccountMode = 'INDIVIDUAL_ONLY' | 'INVITED' | 'DUAL' | 'INSTITUTIONAL_ONLY';

export interface InstitutionMemberRow {
  id: number;
  user_id: number;
  app_user_id: string | null;
  institution_id: number;
  status: MembershipStatus;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function findAppUserByEmailOrUsername(
  emailOrNik: string
): Promise<{ id: string; email: string; nama_lengkap: string; whatsapp: string } | null> {
  const result = await query(
    `SELECT id, email, nama_lengkap, whatsapp FROM users WHERE email = $1 OR username = $1 LIMIT 1`,
    [emailOrNik]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function findOrCreateCmsUser(
  appUser: { id: string; email: string; nama_lengkap: string }
): Promise<number> {
  const existing = await query(
    `SELECT id FROM payload.cms_users WHERE email = $1 LIMIT 1`,
    [appUser.email]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  const result = await query(
    `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at, created_at, updated_at)
     VALUES ($1, $2, 'admin', $3, $4, true, '1.0', NOW(), NOW(), NOW())
     RETURNING id`,
    [appUser.nama_lengkap, appUser.email, '', '']
  );
  return result.rows[0].id;
}

export async function createMembership(
  appUserId: string,
  cmsUserId: number,
  institutionId: number,
  status: MembershipStatus = 'invited'
): Promise<InstitutionMemberRow> {
  const result = await query(
    `INSERT INTO public.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [cmsUserId, appUserId, institutionId, status, status === 'active' ? new Date().toISOString() : null]
  );
  return result.rows[0];
}

export async function createInvitation(
  appUserId: string,
  cmsUserId: number,
  institutionId: number
): Promise<InstitutionMemberRow> {
  return createMembership(appUserId, cmsUserId, institutionId, 'invited');
}

export async function sendInAppNotification(
  userId: string,
  title: string,
  body: string,
  type: string = 'invitation',
  referenceType?: string,
  referenceId?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, title, body, type, referenceType ?? null, referenceId ?? null]
    );
  } catch (err) {
    console.error('Failed to send in-app notification:', err);
  }
}

export async function sendInviteNotification(
  appUserId: string,
  email: string,
  whatsapp: string,
  namaLengkap: string,
  institutionName: string
): Promise<void> {
  const title = 'Undangan Bergabung Institusi';
  const body = `Anda telah diundang untuk bergabung dengan institusi "${institutionName}". Silakan masuk ke akun GuruPRO Anda untuk menerima atau menolak undangan ini.`;

  // Simpan notifikasi in-app
  await sendInAppNotification(appUserId, title, body, 'invitation', 'institution_invite', appUserId);

  // Kirim WhatsApp notification
  if (whatsapp) {
    const waMessage = `[GuruPRO] 🎓 Undangan Bergabung Institusi

Halo ${namaLengkap || 'Bapak/Ibu'},

Anda mendapat undangan untuk bergabung dengan institusi "${institutionName}" di GuruPRO.

Silakan masuk ke akun GuruPRO Anda untuk menerima atau menolak undangan ini.

Terima kasih,
Tim GuruPRO`;

    try {
      const { sendWhatsAppNotification } = await import('./notifications');
      await sendWhatsAppNotification(whatsapp, waMessage);
      console.log(`[Institution] WhatsApp invitation sent to ${whatsapp}`);
    } catch (err) {
      console.error('[Institution] Failed to send WhatsApp invitation:', err);
    }
  }

  // Kirim Email notification
  if (email) {
    const emailSubject = 'Undangan Bergabung Institusi - GuruPRO';
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #4f46e5;">Undangan Bergabung Institusi</h2>
        <p>Halo ${namaLengkap || 'Bapak/Ibu'},</p>
        <p>Anda mendapat undangan untuk bergabung dengan institusi:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <strong style="font-size: 18px;">${institutionName}</strong>
        </div>
        <p>Silakan masuk ke akun GuruPRO Anda untuk menerima atau menolak undangan ini.</p>
        <p>Terima kasih,<br>Tim GuruPRO</p>
      </div>
    `;

    try {
      const { sendEmailNotification } = await import('./notifications');
      await sendEmailNotification(email, emailSubject, emailHtml);
      console.log(`[Institution] Email invitation sent to ${email}`);
    } catch (err) {
      console.error('[Institution] Failed to send email invitation:', err);
    }
  }
}

export async function getUserActiveMemberships(appUserId: string): Promise<InstitutionMemberRow[]> {
  const result = await query(
    `SELECT im.* FROM public.institution_members im
     WHERE im.app_user_id = $1 AND im.status = 'active'`,
    [appUserId]
  );
  return result.rows;
}

export async function hasActiveIndividualSubscription(userId: string): Promise<boolean> {
  const result = await query(
    `SELECT id FROM users
     WHERE id = $1
       AND subscription_status = 'active'
       AND status_langganan != 'free'
       AND subscription_end IS NOT NULL
       AND subscription_end > NOW()
     LIMIT 1`,
    [userId]
  );
  return result.rows.length > 0;
}

export async function getUserAccountMode(userId: string): Promise<AccountMode> {
  const hasInvited = await query(
    `SELECT id FROM public.institution_members
     WHERE app_user_id = $1 AND status = 'invited'
     LIMIT 1`,
    [userId]
  );

  const hasActive = await query(
    `SELECT id FROM public.institution_members
     WHERE app_user_id = $1 AND status = 'active'
     LIMIT 1`,
    [userId]
  );

  const hasSub = await hasActiveIndividualSubscription(userId);

  if (hasActive.rows.length > 0 && hasSub) {
    return 'DUAL';
  }
  if (hasActive.rows.length > 0 && !hasSub) {
    return 'INSTITUTIONAL_ONLY';
  }
  if (hasInvited.rows.length > 0) {
    return 'INVITED';
  }
  return 'INDIVIDUAL_ONLY';
}
