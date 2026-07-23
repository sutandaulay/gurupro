import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { leaveRequests, attendanceSummary, schools, teacherInstitutionAssignments } from '@/lib/schemas/attendance';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { parseISO, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { query } from '@/lib/db';

// Schema untuk validasi input pengajuan izin
const LeaveRequestSchema = z.object({
  type: z.enum(['sakit', 'izin', 'cuti']),
  startDate: z.string().transform((val) => parseISO(val)),
  endDate: z.string().transform((val) => parseISO(val)),
  reason: z.string().min(10, { message: 'Alasan harus diisi minimal 10 karakter' }),
  attachmentUrl: z.string().url().optional().nullable(),
  school_id: z.string().uuid().optional().nullable(),
  institution_id: z.string().uuid().optional().nullable(),
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
    // Untuk guru terinstansi, gunakan institution_id dari assignment
    // Untuk guru mandiri, gunakan school_id jika ada
    let teacherInstitutionId = null;
    let teacherSchoolId = null;
    
    if (validatedData.institution_id) {
      teacherInstitutionId = parseInt(validatedData.institution_id, 10);
    } else if (validatedData.school_id) {
      // Untuk guru mandiri, gunakan school_id
      teacherSchoolId = validatedData.school_id;
    } else {
      // Cek apakah guru memiliki sekolah mandiri
      const schoolResult = await db.select({ id: schools.id })
        .from(schools)
        .where(eq(schools.userId, session.user.id))
        .limit(1);
      
      if (schoolResult.length > 0) {
        teacherSchoolId = schoolResult[0].id;
      } else {
        // Cek institution assignment sebagai fallback
        const assignmentResult = await db.select({ institutionId: teacherInstitutionAssignments.institutionId })
          .from(teacherInstitutionAssignments)
          .where(and(
            eq(teacherInstitutionAssignments.teacherId, session.user.id),
            eq(teacherInstitutionAssignments.status, 'aktif')
          ))
          .limit(1);
        
        if (assignmentResult.length > 0) {
          teacherInstitutionId = assignmentResult[0].institutionId;
        }
      }
    }

    // Buat record pengajuan izin
    const [newLeaveRequest] = await db.insert(leaveRequests).values({
      id: uuidv4(),
      teacherId: session.user.id,
      institutionId: teacherInstitutionId,
      schoolId: teacherSchoolId,
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