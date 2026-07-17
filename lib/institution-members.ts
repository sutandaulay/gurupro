import { query } from '@/lib/db';

export type MembershipStatus = 'invited' | 'active' | 'left' | 'rejected';

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
  const salt = '';
  const hash = '';
  const result = await query(
    `INSERT INTO payload.cms_users (name, email, role, salt, hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id`,
    [appUser.nama_lengkap, appUser.email, 'editor', salt, hash]
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
    `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
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
    `SELECT im.* FROM payload.institution_members im
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
    `SELECT id FROM payload.institution_members
     WHERE app_user_id = $1 AND status = 'invited'
     LIMIT 1`,
    [userId]
  );

  const hasActive = await query(
    `SELECT id FROM payload.institution_members
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
