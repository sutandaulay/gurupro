import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPayload } from '@/lib/payload';
import { getKelasForWaliKelas, getActiveTahunAjaran, getCurrentSemester } from '@/lib/wali-kelas';

/**
 * GET /api/wali-kelas/my-classes
 * Returns classes where current user is the active homeroom teacher
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);

    // Get current user's member ID
    const payload = await getPayload();
    const memberResult = await payload.find({
      collection: 'institution-members',
      where: {
        appUserId: { equals: session.id },
        status: { equals: 'active' },
      },
      limit: 1,
    });

    if (!memberResult.docs.length) {
      return NextResponse.json({ error: 'Member tidak ditemukan' }, { status: 403 });
    }
    const memberId = String(memberResult.docs[0].id);

    // Get active tahun ajaran and semester
    let tahunAjaran: string;
    let semester: 'ganjil' | 'genap';

    const tahunResult = await getActiveTahunAjaran();
    if (tahunResult) {
      tahunAjaran = tahunResult.nama;
      // Determine semester from tahun ajaran
      semester = getCurrentSemester();
    } else {
      // Fallback: use current date
      const now = new Date();
      tahunAjaran = `${now.getFullYear()}/${now.getFullYear() + 1}`;
      semester = now.getMonth() >= 6 ? 'ganjil' : 'genap';
    }

    // Get classes for this wali kelas
    const kelasList = await getKelasForWaliKelas(memberId, tahunAjaran, semester);

    return NextResponse.json({
      data: kelasList.map((k) => ({
        id: k.kelas.id,
        nama_kelas: k.kelas.namaKelas,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/wali-kelas/my-classes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
