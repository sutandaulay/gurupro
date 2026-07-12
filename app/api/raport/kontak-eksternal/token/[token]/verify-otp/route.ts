import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from '@/lib/payload';
import { COLLECTIONS } from '@/collections/config';
import { verifyOtp, isOtpExpired, isOtpMaxAttemptsReached } from '@/lib/performance-share';
import { getKontakByLinkToken } from '@/lib/raport/kontak-eksternal-repository';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { otpCode } = await request.json();

    if (!otpCode || otpCode.length !== 6) {
      return NextResponse.json({ error: 'Kode OTP 6 digit wajib diisi' }, { status: 400 });
    }

    const kontak = await getKontakByLinkToken(token);
    if (!kontak) {
      return NextResponse.json({ error: 'Link tidak valid' }, { status: 404 });
    }

    if (isOtpExpired(kontak.otp_expired_at)) {
      return NextResponse.json({ error: 'Link sudah kedaluwarsa' }, { status: 410 });
    }

    const payload = await getPayload();

    const otpRecords = await payload.find({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      where: {
        performanceShareLinkId: { equals: kontak.id },
      },
      sort: '-createdAt',
      limit: 10,
    });

    if (otpRecords.docs.length === 0) {
      return NextResponse.json(
        { error: 'Kode OTP tidak ditemukan. Mohon minta OTP baru.' },
        { status: 400 }
      );
    }

    let validOtpRecord = null;
    for (const record of otpRecords.docs) {
      const attemptCount = (record.attemptCount as number) || 0;
      if (isOtpMaxAttemptsReached(attemptCount)) continue;

      const expiresAt = new Date(record.expiresAt as string);
      if (isOtpExpired(expiresAt)) continue;

      const isValid = verifyOtp(otpCode, record.otpHash as string);
      if (isValid) {
        validOtpRecord = record;
        break;
      } else {
        await payload.update({
          collection: COLLECTIONS.OTP_VERIFICATIONS,
          id: record.id as string,
          data: { attemptCount: attemptCount + 1 },
        });
      }
    }

    if (!validOtpRecord) {
      return NextResponse.json({ error: 'Kode OTP tidak valid' }, { status: 400 });
    }

    await payload.update({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      id: validOtpRecord.id as string,
      data: { verifiedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Verifikasi berhasil',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
