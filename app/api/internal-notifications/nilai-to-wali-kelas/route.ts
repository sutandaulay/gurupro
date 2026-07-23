import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getWaliKelasForKelas } from '@/lib/wali-kelas';
import { sendInAppNotification } from '@/lib/institution-members';
import { cookies } from 'next/headers';
import { getPayload } from '@/lib/payload';

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const { siswaId, kelasId, contentType, dataId, periode } = reqBody;

    if (!siswaId || !kelasId || !contentType || !dataId) {
      return NextResponse.json({ error: 'siswaId, kelasId, contentType, dan dataId wajib diisi' }, { status: 400 });
    }

    const validContentTypes = ['raport', 'ekskul', 'project'];
    if (!validContentTypes.includes(contentType)) {
      return NextResponse.json({ error: 'contentType tidak valid. Gunakan: raport, ekskul, atau project' }, { status: 400 });
    }

    // Get current user session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);

    // Verify user is a member of the institution
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
      return NextResponse.json({ error: 'Member tidak ditemukan atau tidak aktif' }, { status: 403 });
    }
    const actorMemberId = String(memberResult.docs[0].id);

    // Verify the user has ownership of the data being shared
    // For raport
    if (contentType === 'raport') {
      const raportRes = await query(
        `SELECT dnrm.guru_mapel_member_id
         FROM data_raport dr
         JOIN data_raport_nilai_mapel dnrm ON dnrm.data_raport_id = dr.id
         WHERE dr.id = $1 AND dr.siswa_id = $2`,
        [dataId, siswaId]
      );

      if (!raportRes.rows.length) {
        return NextResponse.json({ error: 'Raport tidak ditemukan atau tidak sesuai dengan siswa' }, { status: 404 });
      }

      // Verify the actor is the owner of the nilai
      if (raportRes.rows[0].guru_mapel_member_id !== actorMemberId) {
        return NextResponse.json({ error: 'Anda tidak memiliki izin untuk membagikan nilai ini' }, { status: 403 });
      }
    }

    // For ekskul
    if (contentType === 'ekskul') {
      const ekskulRes = await query(
        `SELECT dinilai_oleh
         FROM penilaian_ekstrakurikuler
         WHERE id = $1 AND siswa_id = $2`,
        [dataId, siswaId]
      );

      if (!ekskulRes.rows.length) {
        return NextResponse.json({ error: 'Nilai ekstrakurikuler tidak ditemukan atau tidak sesuai dengan siswa' }, { status: 404 });
      }

      // Verify the actor is the owner of the nilai
      if (ekskulRes.rows[0].dinilai_oleh !== actorMemberId) {
        return NextResponse.json({ error: 'Anda tidak memiliki izin untuk membagikan nilai ini' }, { status: 403 });
      }
    }

    // Get the active tahun ajaran and semester
    let tahunAjaran = '';
    let semester: 'ganjil' | 'genap' = 'ganjil';
    
    try {
      const ta = await query(`SELECT nama FROM tahun_ajaran WHERE is_active = true LIMIT 1`);
      if (ta.rows.length > 0) {
        tahunAjaran = ta.rows[0].nama;
        // Extract semester from tahun ajaran if available, otherwise default to ganjil
        semester = tahunAjaran.toLowerCase().includes('genap') ? 'genap' : 'ganjil';
      }
    } catch {
      // Continue without tahun ajaran
    }

    // Get the wali kelas for this class
    const waliKelas = await getWaliKelasForKelas(kelasId, tahunAjaran, semester);
    if (!waliKelas || !waliKelas.guru) {
      return NextResponse.json({ error: 'Wali kelas tidak ditemukan untuk kelas ini' }, { status: 404 });
    }

    // Get student name for the notification
    const studentRes = await query(
      `SELECT nama_siswa FROM students WHERE id = $1`,
      [siswaId]
    );
    const studentName = studentRes.rows[0]?.nama_siswa || 'Siswa';

    // Create notification title and body based on content type
    let title = '';
    let notifBody = '';
    let referenceType = '';

    switch (contentType) {
      case 'raport':
        title = 'Nilai Raport Baru Siap Dibagikan';
        notifBody = `Nilai raport siswa ${studentName} sudah kami rangkum dan siap Anda lihat bersama orang tua. Terima kasih sudah mendampingi murid-murid Anda.`;
        referenceType = 'nilai_raport';
        break;
      case 'ekskul':
        title = 'Nilai Ekstrakurikuler Baru Siap Dibagikan';
        notifBody = `Nilai ekstrakurikuler siswa ${studentName} sudah kami rangkum dan siap Anda lihat bersama orang tua. Terima kasih sudah mendampingi murid-murid Anda.`;
        referenceType = 'nilai_ekskul';
        break;
      case 'project':
        title = 'Nilai Project Baru Siap Dibagikan';
        notifBody = `Nilai project siswa ${studentName} sudah kami rangkum dan siap Anda lihat bersama orang tua. Terima kasih sudah mendampingi murid-murid Anda.`;
        referenceType = 'nilai_project';
        break;
      default:
        return NextResponse.json({ error: 'contentType tidak valid' }, { status: 400 });
    }

    // Send in-app notification to wali kelas
    await sendInAppNotification(
      waliKelas.waliKelasMemberId,
      title,
      notifBody,
      referenceType,
      dataId,
      'info'
    );

    return NextResponse.json({
      success: true,
      message: `Notifikasi berhasil dikirim ke Wali Kelas`,
      waliKelasId: waliKelas.waliKelasMemberId,
      notificationTitle: title,
    });
  } catch (error: any) {
    console.error('Error sending internal notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}