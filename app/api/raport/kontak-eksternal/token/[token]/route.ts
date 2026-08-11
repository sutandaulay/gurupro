import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getKontakByLinkToken, logAkses, getDataRaportForKelas, isOtpVerified } from '@/lib/raport/kontak-eksternal-repository';
import { isOtpExpired } from '@/lib/performance-share';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const kontak = await getKontakByLinkToken(token);
    if (!kontak) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 404 });
    }

    if (isOtpExpired(kontak.otp_expired_at)) {
      return NextResponse.json({ error: 'Link sudah kedaluwarsa' }, { status: 410 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await logAkses(kontak.id, ipAddress);

    const kelasRes = await query(`SELECT nama_kelas FROM classes WHERE id = $1`, [kontak.kelas_id]);
    const kelasNama = kelasRes.rows[0]?.nama_kelas || '';

    const guruRes = await query(
      `SELECT u.nama_lengkap FROM public.institution_members im
       JOIN users u ON u.id = im.app_user_id
       WHERE im.app_user_id = $1`,
      [kontak.guru_mapel_member_id]
    );
    const guruMapelNama = guruRes.rows[0]?.nama_lengkap || 'Guru';

    const otpVerified = await isOtpVerified(kontak.id);
    const dataRaports = otpVerified ? await getDataRaportForKelas(kontak.kelas_id) : [];

    return NextResponse.json({
      kontak: {
        id: kontak.id,
        namaKontak: kontak.nama_kontak,
        kontakWA: kontak.kontak_wa,
        kontakEmail: kontak.kontak_email,
        statusKlaim: kontak.status_klaim,
        claimedByMemberId: kontak.claimed_by_member_id,
      },
      kelasNama,
      guruMapelNama,
      otpExpiredAt: kontak.otp_expired_at,
      otpVerified,
      dataRaports,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
