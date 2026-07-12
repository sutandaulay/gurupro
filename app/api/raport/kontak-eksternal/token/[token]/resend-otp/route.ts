import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from '@/lib/payload';
import { COLLECTIONS, OTP_VALIDITY_MINUTES, OTP_RESEND_RATE_LIMIT_PER_HOUR } from '@/collections/config';
import { generateOtp, hashOtp, getOtpExpiryDate, isOtpExpired } from '@/lib/performance-share';
import { sendWhatsAppNotification, sendEmailNotification } from '@/lib/notifications';
import { getKontakByLinkToken } from '@/lib/raport/kontak-eksternal-repository';
import { generateKontakEksternalOtpWA } from '@/lib/raport/eksternal-email-templates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { channel } = await request.json();

    const kontak = await getKontakByLinkToken(token);
    if (!kontak) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 404 });
    }

    if (isOtpExpired(kontak.otp_expired_at)) {
      return NextResponse.json({ error: 'Link sudah kedaluwarsa' }, { status: 410 });
    }

    const kontakId = kontak.id;

    const payload = await getPayload();

    const recentOtps = await payload.find({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      where: {
        performanceShareLinkId: { equals: kontakId },
        channel: { equals: channel || 'whatsapp' },
      },
      sort: '-createdAt',
      limit: OTP_RESEND_RATE_LIMIT_PER_HOUR + 1,
    });

    if (recentOtps.docs.length >= OTP_RESEND_RATE_LIMIT_PER_HOUR) {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      const recentInLastHour = recentOtps.docs.filter(
        (otp) => new Date(otp.createdAt as string) > oneHourAgo
      );
      if (recentInLastHour.length >= OTP_RESEND_RATE_LIMIT_PER_HOUR) {
        return NextResponse.json(
          { error: `Terlalu banyak permintaan. Maksimal ${OTP_RESEND_RATE_LIMIT_PER_HOUR}x per jam.` },
          { status: 429 }
        );
      }
    }

    await (payload as any).updateMany({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      where: {
        performanceShareLinkId: { equals: kontakId },
        verifiedAt: { equals: null },
      },
      data: { expiresAt: new Date() },
    });

    const newOtp = generateOtp();
    const newOtpHash = hashOtp(newOtp);
    const expiresAt = getOtpExpiryDate();
    const sentTo = channel === 'email' ? kontak.kontak_email : kontak.kontak_wa;

    await payload.create({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      data: {
        performanceShareLinkId: kontakId,
        otpHash: newOtpHash,
        channel: channel || 'whatsapp',
        sentTo,
        expiresAt,
        attemptCount: 0,
      },
    });

    if (channel === 'email' && kontak.kontak_email) {
      const subject = 'Kode Verifikasi Akses Raport - GuruPRO AI';
      const html = `
        <h2>Kode Verifikasi Akses Raport</h2>
        <p>Yth. ${kontak.nama_kontak},</p>
        <p>Masukkan kode berikut untuk mengakses data raport:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${newOtp}</p>
        <p>Berlaku ${OTP_VALIDITY_MINUTES} menit.</p>`;
      await sendEmailNotification(kontak.kontak_email, subject, html);
    }

    if (channel !== 'email' && kontak.kontak_wa) {
      const waMsg = generateKontakEksternalOtpWA(kontak.nama_kontak, newOtp);
      await sendWhatsAppNotification(kontak.kontak_wa, waMsg);
    }

    return NextResponse.json({
      success: true,
      message: 'OTP berhasil dikirim',
      expiresInMinutes: OTP_VALIDITY_MINUTES,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
