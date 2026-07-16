import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendanceDevices } from '@/lib/schemas/attendance';
import { eq } from 'drizzle-orm';

// Schema untuk validasi input
const ApproveDeviceSchema = z.object({
  deviceId: z.string().uuid(),
  approved: z.boolean(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validasi sesi pengguna (seharusnya admin)
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deviceId = params.id;
    
    // Validasi ID device
    const parsedId = z.string().uuid().parse(deviceId);

    // Ambil device dari database
    const [device] = await db.select().from(attendanceDevices).where(eq(attendanceDevices.id, parsedId));
    
    if (!device) {
      return NextResponse.json({ error: 'Device tidak ditemukan' }, { status: 404 });
    }

    // Update status device (aktifkan jika disetujui)
    await db.update(attendanceDevices)
      .set({
        isActive: true,
      })
      .where(eq(attendanceDevices.id, parsedId));

    return NextResponse.json({
      success: true,
      message: 'Device berhasil disetujui',
      deviceId: parsedId,
    });
  } catch (error) {
    console.error('Approve device error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validasi input gagal', 
          details: error.errors 
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