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
    `SELECT id FROM cms_users WHERE email = $1 LIMIT 1`,
    [appUser.email]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  const salt = '';
  const hash = '';
  const result = await query(
    `INSERT INTO cms_users (name, email, password, role, salt, hash, created_at, updated_at)
     VALUES ($1, $2, '', $3, $4, $5, NOW(), NOW())
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
    `INSERT INTO institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
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

  await sendInAppNotification(appUserId, title, body, 'invitation', 'institution_invite', appUserId);

  // TODO: Integrasi WhatsApp — placeholder
  console.log(`[TODO] Kirim WA ke ${whatsapp} untuk user ${appUserId}: ${body}`);

  // TODO: Integrasi Email — placeholder
  console.log(`[TODO] Kirim Email ke ${email} untuk user ${appUserId}: ${body}`);
}

export async function getUserActiveMemberships(appUserId: string): Promise<InstitutionMemberRow[]> {
  const result = await query(
    `SELECT im.* FROM institution_members im
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
    `SELECT id FROM institution_members
     WHERE app_user_id = $1 AND status = 'invited'
     LIMIT 1`,
    [userId]
  );

  const hasActive = await query(
    `SELECT id FROM institution_members
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
