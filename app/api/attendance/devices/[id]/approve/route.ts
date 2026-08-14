import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendanceDevices } from '@/lib/schemas/attendance';
import { eq } from 'drizzle-orm';
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

// Schema untuk validasi input
const ApproveDeviceSchema = z.object({
  deviceId: z.string().uuid(),
  approved: z.boolean(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deviceId = id;
    
    // Validasi ID device
    const parsedId = z.string().uuid().parse(deviceId);

    // Validasi body (approved)
    const body = await req.json().catch(() => ({}));
    const validatedBody = ApproveDeviceSchema.parse({ deviceId: parsedId, approved: body.approved === false ? false : true });

    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ambil device dari database
    const [device] = await db.select().from(attendanceDevices).where(eq(attendanceDevices.id, parsedId));
    
    if (!device) {
      return NextResponse.json({ error: 'Device tidak ditemukan' }, { status: 404 });
    }

    // Otorisasi: hanya admin/operator/kepala_sekolah yang bisa menyetujui device
    if (!['admin', 'operator', 'kepala_sekolah'].includes(session.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update status device (aktifkan jika disetujui)
    await db.update(attendanceDevices)
      .set({
        isActive: validatedBody.approved,
      })
      .where(eq(attendanceDevices.id, parsedId));

    return NextResponse.json({
      success: true,
      message: validatedBody.approved ? 'Device berhasil disetujui' : 'Device berhasil dinonaktifkan',
      deviceId: parsedId,
    });
  } catch (error) {
    console.error('Approve device error:', error);
    
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