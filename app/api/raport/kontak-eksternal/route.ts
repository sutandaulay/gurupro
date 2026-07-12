import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createKontakEksternal, getKontakByGuruMapel } from '@/lib/raport/kontak-eksternal-repository';
import { sendEmailNotification, sendWhatsAppNotification } from '@/lib/notifications';
import { generateKontakEksternalLinkEmail } from '@/lib/raport/eksternal-email-templates';
import { getDataRaportForKelas, getNilaiMapelForRaport } from '@/lib/raport/kontak-eksternal-repository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guruMapelMemberId, namaKontak, kontakWA, kontakEmail, kelasId } = body;

    if (!guruMapelMemberId || !namaKontak || !kelasId) {
      return NextResponse.json({ error: 'guruMapelMemberId, namaKontak, dan kelasId wajib diisi' }, { status: 400 });
    }

    if (!kontakWA && !kontakEmail) {
      return NextResponse.json({ error: 'WA atau email wajib diisi' }, { status: 400 });
    }

    const result = await createKontakEksternal({
      guruMapelMemberId,
      namaKontak,
      kontakWA,
      kontakEmail,
      kelasId,
      otpExpiredAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const baseUrl = request.nextUrl.origin;
    const linkUrl = `${baseUrl}/raport-eksternal/${result.linkToken}`;

    const kelasRes = await query(`SELECT nama_kelas FROM classes WHERE id = $1`, [kelasId]);
    const kelasNama = kelasRes.rows[0]?.nama_kelas || '';

    const guruRes = await query(
      `SELECT u.nama_lengkap FROM institution_members im
       JOIN users u ON u.id = im.app_user_id
       WHERE im.app_user_id = $1`,
      [guruMapelMemberId]
    );
    const guruMapelNama = guruRes.rows[0]?.nama_lengkap || 'Guru';

    const emailContent = generateKontakEksternalLinkEmail({
      kontakNama: namaKontak,
      guruMapelNama,
      kelasNama,
      linkUrl,
    });

    if (kontakEmail) {
      await sendEmailNotification(kontakEmail, emailContent.subject, emailContent.html);
    }

    if (kontakWA) {
      const waMessage = `Yth. ${namaKontak},

${guruMapelNama} telah membagikan data raport kelas ${kelasNama} melalui GuruPRO AI.

Lihat data raport di: ${linkUrl}

Link berlaku 72 jam demi keamanan data siswa.`;
      await sendWhatsAppNotification(kontakWA, waMessage);
    }

    return NextResponse.json({
      success: true,
      id: result.id,
      linkToken: result.linkToken,
      linkUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const guruMapelMemberId = searchParams.get('guruMapelMemberId');
    const kelasId = searchParams.get('kelasId');

    if (!guruMapelMemberId) {
      return NextResponse.json({ error: 'guruMapelMemberId wajib diisi' }, { status: 400 });
    }

    const kontaks = await getKontakByGuruMapel(guruMapelMemberId, kelasId || undefined);
    return NextResponse.json({ kontaks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
