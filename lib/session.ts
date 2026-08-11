import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { getUserActiveMemberships } from '@/lib/institution-members';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';

export type ActiveContext =
  | 'individual'
  | { institutionId: number };

export interface SessionData {
  id: string;
  role: string;
  activeContext?: ActiveContext;
}

export interface ContextFilter {
  institutionId: number | null;
  assignedMapel: string[];
  assignedKelas: string[];
}

function parseSession(data?: string): SessionData | null {
  if (!data) return null;
  try {
    return JSON.parse(data) as SessionData;
  } catch {
    return null;
  }
}

function sessionCookieOptions(maxAge: number = 60 * 60 * 24 * 7) {
  const isProd = process.env.NODE_ENV === 'production';
  // Secure only in production, unless explicitly overridden
  const secure = isProd && process.env.SESSION_COOKIE_SECURE !== 'false';
  // In production (HTTPS), sameSite must be 'none' for cross-origin
  // In development (HTTP), use 'lax'
  const sameSite: 'lax' | 'none' = isProd ? 'none' : 'lax';
  return { httpOnly: true, secure, sameSite, maxAge, path: '/' };
}

export async function getSession(): Promise<SessionData | null> {
  // 1. Try gurupro_session cookie first (set by manual login)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  const parsed = parseSession(sessionCookie);
  if (parsed?.id) {
    return parsed;
  }

  // 2. Fallback: check NextAuth session (Google OAuth login)
  try {
    const nextAuthSession = await getServerSession(authOptions);
    if (nextAuthSession?.user?.email) {
      const userRes = await query(
        'SELECT id, role FROM users WHERE email = $1',
        [nextAuthSession.user.email.toLowerCase()]
      );
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        const sessionData: SessionData = {
          id: String(user.id),
          role: user.role || 'guru',
          activeContext: 'individual',
        };

        // Also set gurupro_session cookie so subsequent requests are faster
        try {
          cookieStore.set('gurupro_session', JSON.stringify(sessionData), sessionCookieOptions());
        } catch {
          // cookies().set() may not be available in all contexts, ignore
        }

        return sessionData;
      }
    }
  } catch {
    // NextAuth not available, ignore
  }

  return null;
}

export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getActiveContext(): Promise<ActiveContext | undefined> {
  const session = await getSession();
  return session?.activeContext;
}

export async function setActiveContext(context: ActiveContext): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) return;

    const session = JSON.parse(sessionCookie);
    session.activeContext = context;

    cookieStore.set('gurupro_session', JSON.stringify(session), sessionCookieOptions());
  } catch (err) {
    console.error('setActiveContext failed:', err);
  }
}

export async function setDefaultSessionCookie(
  sessionData: Omit<SessionData, 'activeContext'>,
): Promise<void> {
  const data: SessionData = {
    ...sessionData,
    activeContext: 'individual',
  };

  (await cookies()).set('gurupro_session', JSON.stringify(data), sessionCookieOptions());
}

export async function getContextFilters(userId: string): Promise<ContextFilter> {
  const activeContext = await getActiveContext();
  const result: ContextFilter = {
    institutionId: null,
    assignedMapel: [],
    assignedKelas: [],
  };

  if (!activeContext || activeContext === 'individual') {
    return result;
  }

  result.institutionId = activeContext.institutionId;

  const memberships = await getUserActiveMemberships(userId);
  const member = memberships.find((m) => m.institution_id === activeContext.institutionId);
  if (!member) return result;

  const [mapelResult, kelasResult] = await Promise.all([
    query(
      'SELECT mapel FROM institution_members_assigned_mapel WHERE _parent_id = $1',
      [member.id]
    ),
    query(
      'SELECT kelas FROM institution_members_assigned_kelas WHERE _parent_id = $1',
      [member.id]
    ),
  ]);

  result.assignedMapel = mapelResult.rows.map((r: any) => r.mapel);
  result.assignedKelas = kelasResult.rows.map((r: any) => r.kelas);

  return result;
}
