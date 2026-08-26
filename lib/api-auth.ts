/**
 * Reusable auth helper for API routes.
 * Provides getSession() and requireSession() — use in every protected route.
 */
import { cookies } from 'next/headers';
import { parseSessionCookie } from './session-sign';
import { NextResponse } from 'next/server';

export interface SessionUser {
  id: string;
  role: string;
  roles: string[];
  activeContext: 'individual' | { institutionId: number };
  lastInstitutionId: number | null;
  sid?: string;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session')?.value;
  if (!sessionCookie) return null;

  const session = parseSessionCookie(sessionCookie);
  if (!session) return null;

  return {
    id: session.id,
    role: session.role || 'guru',
    roles: Array.isArray(session.roles) ? session.roles : [session.role || 'guru'],
    activeContext: session.activeContext as SessionUser['activeContext'],
    lastInstitutionId: session.lastInstitutionId ?? null,
    sid: session.sid,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    return null as never; // caller should return 401
  }
  return session;
}

/**
 * Common auth wrapper pattern — use in every API route GET/POST/PUT/DELETE.
 * Returns the session if authenticated, or a NextResponse 401 if not.
 *
 * Usage:
 *   const session = await requireAuth();
 *   if (session instanceof NextResponse) return session;
 */
export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}
