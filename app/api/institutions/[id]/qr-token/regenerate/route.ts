import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { institutions as institutionsTable } from '@/lib/schemas/main-schema'; // Sesuaikan path dengan schema utama Anda
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Schema untuk validasi input
const RegenerateQRTokenSchema = z.object({
  institutionId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const institutionId = id;
    
    // Validasi ID institusi
    const parsedId = z.string().uuid().parse(institutionId);

    // Ambil institusi dari database
    const [institution] = await db.select().from(institutionsTable).where(eq(institutionsTable.id, parsedId));
    
    if (!institution) {
      return NextResponse.json({ error: 'Institusi tidak ditemukan' }, { status: 404 });
    }

    // Generate QR token baru (format UUID)
    const newQrToken = uuidv4();

    // Update institusi dengan QR token baru
    // Kita perlu menggabungkan dengan data attendanceSettings yang ada
    const currentSettings = institution.attendanceSettings ? JSON.parse(institution.attendanceSettings as string) : {};
    const updatedSettings = {
      ...currentSettings,
      qrCodeToken: newQrToken,
      qrCodeLastGenerated: new Date().toISOString(),
    };

    await db.update(institutionsTable)
      .set({
        attendanceSettings: JSON.stringify(updatedSettings),
      })
      .where(eq(institutionsTable.id, parsedId));

    return NextResponse.json({
      success: true,
      message: 'QR token berhasil diperbarui',
      institutionId: parsedId,
      newQrToken: newQrToken,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Regenerate QR token error:', error);
    
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