import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUserAccountMode } from '@/lib/institution-members';
import { parseSessionCookie } from '@/lib/session-sign';

async function getUserId() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
  if (!session) throw new Error('Unauthorized');
  return session.id;
}

export async function GET() {
  try {
    const userId = await getUserId();
    const mode = await getUserAccountMode(userId);
    return NextResponse.json({ mode });
  } catch (error: any) {
    console.error('Account mode error:', error);
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}
