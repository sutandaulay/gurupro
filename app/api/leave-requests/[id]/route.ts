import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db, query } from '@/lib/db';
import { 
  leaveRequests, 
  attendanceSummary,
  institutions as institutionsTable,
  institutionMembers
} from '@/lib/schemas/attendance';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { parseISO, eachDayOfInterval, format, startOfDay } from 'date-fns';
import { suggestSubstitutes } from '@/lib/substitute-suggestion';
import { sendWhatsAppNotification } from '@/lib/notifications';

// Schema untuk validasi input approval/rejection
const UpdateLeaveRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestId = id;
    
    // Validasi ID request
    const requestIdParsed = z.string().uuid().parse(requestId);

    // Parse dan validasi request body
    const body = await req.json();
    const validatedData = UpdateLeaveRequestSchema.parse(body);

    // Ambil request izin dari database
    const [existingRequest] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, requestIdParsed));
    
    if (!existingRequest) {
      return NextResponse.json({ error: 'Permintaan izin tidak ditemukan' }, { status: 404 });
    }

    // Cek akses berdasarkan institusi
    // User hanya bisa mengakses izin di institusi yang mereka miliki akses
    const userInstitutionMembers = await db.select().from(institutionMembers)
      .where(and(
        eq(institutionMembers.userId, session.user.id),
        eq(institutionMembers.institutionId, existingRequest.institutionId)
      ));

    if (userInstitutionMembers.length === 0 && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses ke institusi ini' }, { status: 403 });
    }

    // Cek apakah user memiliki peran yang sesuai untuk menyetujui izin
    const userMember = userInstitutionMembers[0];
    const allowedRoles = ['admin', 'operator', 'kepala_sekolah', 'wakasek'];
    
    if (!allowedRoles.includes(userMember.role) && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki izin untuk menyetujui izin' }, { status: 403 });
    }

    // Update status request
    const [updatedRequest] = await db.update(leaveRequests)
      .set({
        status: validatedData.status,
        approvedBy: session.user.id,
        approvedAt: new Date(),
        notes: validatedData.notes || null,
      })
      .where(eq(leaveRequests.id, requestIdParsed))
      .returning();

    // Jika permintaan disetujui, update summary kehadiran
    if (validatedData.status === 'approved') {
      await updateAttendanceSummaryForApprovedLeave(
        existingRequest.teacherId,
        existingRequest.institutionId,
        existingRequest.startDate,
        existingRequest.endDate,
        existingRequest.type
      );

      // Sprint 4.5 — Saran guru pengganti + auto-share RPP (READ-ONLY, try/catch aman)
      // Tidak mengubah logika approve/attendance di atas.
      try {
        const suggestions = await suggestSubstitutes(
          Number(existingRequest.institutionId),
          existingRequest.teacherId,
          existingRequest.startDate,
          existingRequest.endDate
        );

        // Cari RPP/Modul Ajar terbaru guru yang izin untuk di-share ke pengganti
        const rppRes = await query(
          `SELECT id, judul_dokumen FROM guru_administrasi
           WHERE user_id = $1 AND tipe_dokumen IN ('rpp','modul')
             AND approval_status IN ('draft','approved')
           ORDER BY created_at DESC LIMIT 3`,
          [existingRequest.teacherId]
        );
        const rppList = rppRes.rows.map((r: any) => `• ${r.judul_dokumen}`).join("\n");

        for (const s of suggestions) {
          if (!s.whatsapp) continue;
          const msg = `[GuruPRO] 📋 Guru ${existingRequest.type} pada ${String(existingRequest.startDate).slice(0,10)}–${String(existingRequest.endDate).slice(0,10)}.\n` +
            `Anda disarankan sebagai guru pengganti.` +
            (rppList ? `\nRPP/Modul Ajar yang bisa dipakai:\n${rppList}` : "") +
            `\n\nLogin GuruPRO untuk detail.`;
          await sendWhatsAppNotification(s.whatsapp, msg);
        }
      } catch (subErr) {
        console.error("Substitute suggestion (non-fatal):", subErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Permintaan izin berhasil ${validatedData.status === 'approved' ? 'disetujui' : 'ditolak'}`,
      leaveRequest: {
        id: updatedRequest.id,
        status: updatedRequest.status,
        approvedBy: updatedRequest.approvedBy,
        approvedAt: updatedRequest.approvedAt,
        notes: updatedRequest.notes,
      }
    });
  } catch (error) {
    console.error('Update leave request error:', error);
    
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

// Fungsi untuk update attendance summary ketika izin disetujui
async function updateAttendanceSummaryForApprovedLeave(
  teacherId: string,
  institutionId: string,
  startDate: string,
  endDate: string,
  leaveType: string
) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  // Dapatkan semua tanggal dalam rentang izin
  const dates = eachDayOfInterval({ start, end });

  for (const date of dates) {
    // Format tanggal ke YYYY-MM-DD dan buat objek Date paling awal hari
    const dateStr = format(date, 'yyyy-MM-dd');
    const dateObj = startOfDay(new Date(dateStr)); // startOfDay ensures time is 00:00:00

    // Cek apakah sudah ada summary untuk tanggal ini
    const [existingSummary] = await db.select()
      .from(attendanceSummary)
      .where(and(
        eq(attendanceSummary.teacherId, teacherId),
        eq(attendanceSummary.institutionId, institutionId),
        eq(attendanceSummary.date, dateObj)
      ));

    if (existingSummary) {
      // Update summary yang ada
      await db.update(attendanceSummary)
        .set({
          attendanceStatus: leaveType === 'sakit' ? 'sakit' : leaveType === 'izin' ? 'izin' : 'cuti',
          updatedAt: new Date(),
        })
        .where(eq(attendanceSummary.id, existingSummary.id));
    } else {
      // Buat summary baru
      await db.insert(attendanceSummary).values({
        id: uuidv4(),
        teacherId,
        institutionId,
        date: dateObj,
        attendanceStatus: leaveType === 'sakit' ? 'sakit' : leaveType === 'izin' ? 'izin' : 'cuti',
      });
    }
  }
}

// Handler untuk GET (mengambil detail satu pengajuan izin)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestId = id;
    const requestIdParsed = z.string().uuid().parse(requestId);

    // Ambil request izin dari database
    const [leaveRequest] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, requestIdParsed));
    
    if (!leaveRequest) {
      return NextResponse.json({ error: 'Permintaan izin tidak ditemukan' }, { status: 404 });
    }

    // Cek akses: admin bisa lihat semua, user hanya bisa lihat di institusi yang mereka miliki akses
    if (session.user.role !== 'admin') {
      const userInstitutionMembers = await db.select().from(institutionMembers)
        .where(and(
          eq(institutionMembers.userId, session.user.id),
          eq(institutionMembers.institutionId, leaveRequest.institutionId)
        ));

      if (userInstitutionMembers.length === 0) {
        return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses ke institusi ini' }, { status: 403 });
      }
    }

    return NextResponse.json({
      success: true,
      leaveRequest
    });
  } catch (error) {
    console.error('Get leave request error:', error);
    
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