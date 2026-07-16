import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { leaveRequests, attendanceSummary } from '@/lib/schemas/attendance';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { parseISO, eachDayOfInterval, isWithinInterval } from 'date-fns';

// Schema untuk validasi input pengajuan izin
const LeaveRequestSchema = z.object({
  type: z.enum(['sakit', 'izin', 'cuti']),
  startDate: z.string().transform((val) => parseISO(val)),
  endDate: z.string().transform((val) => parseISO(val)),
  reason: z.string().min(10, { message: 'Alasan harus diisi minimal 10 karakter' }),
  attachmentUrl: z.string().url().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    // Validasi sesi pengguna
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse dan validasi request body
    const body = await req.json();
    const validatedData = LeaveRequestSchema.parse(body);

    // Validasi bahwa tanggal mulai tidak setelah tanggal selesai
    if (validatedData.startDate > validatedData.endDate) {
      return NextResponse.json(
        { error: 'Tanggal mulai tidak boleh setelah tanggal selesai' }, 
        { status: 400 }
      );
    }

    // Cek apakah sudah ada pengajuan izin di rentang tanggal yang sama
    const conflictingRequests = await db.select()
      .from(leaveRequests)
      .where(and(
        eq(leaveRequests.teacherId, session.user.id),
        eq(leaveRequests.status, 'pending'),
      ));

    // Cek konflik tanggal
    for (const req of conflictingRequests) {
      const reqStart = parseISO(req.startDate);
      const reqEnd = parseISO(req.endDate);
      
      // Cek apakah rentang tanggal tumpang tindih
      if (
        (validatedData.startDate <= reqEnd && validatedData.endDate >= reqStart)
      ) {
        return NextResponse.json(
          { 
            error: 'Anda sudah memiliki pengajuan izin yang menunggu persetujuan di rentang tanggal ini',
            conflictDate: {
              startDate: req.startDate,
              endDate: req.endDate,
              type: req.type,
            }
          }, 
          { status: 400 }
        );
      }
    }

    // Dapatkan institusi dari assignment guru
    // Dalam implementasi nyata, ini akan mengambil institusi aktif dari teacher_institution_assignments
    // Untuk simulasi, kita asumsikan guru terdaftar di satu institusi
    const teacherInstitutionId = 'default-inst-id'; // Ini harus diambil dari assignment guru

    // Buat record pengajuan izin
    const [newLeaveRequest] = await db.insert(leaveRequests).values({
      id: uuidv4(),
      teacherId: session.user.id,
      institutionId: teacherInstitutionId,
      type: validatedData.type,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      reason: validatedData.reason,
      attachmentUrl: validatedData.attachmentUrl || null,
      status: 'pending',
    }).returning();

    return NextResponse.json({
      success: true,
      message: 'Permintaan izin berhasil diajukan',
      leaveRequest: {
        id: newLeaveRequest.id,
        type: newLeaveRequest.type,
        startDate: newLeaveRequest.startDate,
        endDate: newLeaveRequest.endDate,
        reason: newLeaveRequest.reason,
        status: newLeaveRequest.status,
      }
    });
  } catch (error) {
    console.error('Leave request error:', error);
    
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

// Handler untuk GET (mengambil daftar pengajuan izin)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Jika user adalah admin, ambil semua pengajuan izin
    // Jika user adalah guru, hanya ambil pengajuan izin miliknya sendiri
    let leaveRequestsList;
    if (session.user.role === 'admin') {
      leaveRequestsList = await db.select().from(leaveRequests);
    } else {
      leaveRequestsList = await db.select().from(leaveRequests)
        .where(eq(leaveRequests.teacherId, session.user.id));
    }

    return NextResponse.json({
      success: true,
      leaveRequests: leaveRequestsList
    });
  } catch (error) {
    console.error('Get leave requests error:', error);
    
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}