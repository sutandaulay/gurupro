import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getSessionFromCookieHeader } from '@/lib/session-sign';

async function getSessionUser(req: Request) {
  const cookieSession = getSessionFromCookieHeader(req.headers.get('cookie'));
  if (cookieSession?.id) {
    return { id: cookieSession.id, role: cookieSession.role || 'guru' };
  }
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { id: session.user.id as string, role: (session.user as any).role || 'guru' };
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const institutionId = z.coerce.number().int().positive().parse(id);

    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instResult = await query(
      `SELECT id FROM payload.institutions WHERE id = $1`,
      [institutionId]
    );
    if (instResult.rows.length === 0) {
      return NextResponse.json({ error: 'Institusi tidak ditemukan' }, { status: 404 });
    }

    // Otorisasi: hanya global admin atau role institusi (admin/operator/kepala_sekolah/wakasek)
    if (session.role !== 'admin') {
      const memberRes = await query(
        `SELECT imr.value FROM public.institution_members im
         JOIN public.institution_members_role imr ON imr.parent_id = im.id
         WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
        [session.id, institutionId]
      );
      const roles = memberRes.rows.map((r: any) => r.value);
      const allowed = ['admin', 'operator', 'kepala_sekolah', 'wakasek'].some((r) => roles.includes(r));
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const newQrToken = uuidv4();

    await query(
      `UPDATE payload.institutions
       SET attendance_settings_qr_code_token = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [newQrToken, institutionId]
    );

    return NextResponse.json({
      success: true,
      message: 'QR token berhasil diperbarui',
      institutionId,
      newQrToken,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Regenerate QR token error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validasi input gagal',
          details: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
