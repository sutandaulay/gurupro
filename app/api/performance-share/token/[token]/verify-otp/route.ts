import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS } from "@/collections/config";
import { verifyOtp, isOtpExpired, isOtpMaxAttemptsReached } from "@/lib/performance-share";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { otpCode, documentCategory } = body;

    if (!otpCode) {
      return NextResponse.json(
        { error: "Kode OTP wajib diisi" },
        { status: 400 }
      );
    }

    const payload = await getPayload();

    const shareLink = await payload.find({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      where: {
        shareToken: { equals: token },
      },
      limit: 1,
    });

    if (shareLink.docs.length === 0) {
      return NextResponse.json(
        { error: "Link tidak ditemukan" },
        { status: 404 }
      );
    }

    const linkId = shareLink.docs[0].id as string;

    const otpRecords = await payload.find({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      where: {
        performanceShareLinkId: { equals: linkId },
      },
      sort: "-createdAt",
      limit: 10,
    });

    if (otpRecords.docs.length === 0) {
      return NextResponse.json(
        { error: "Kode OTP tidak ditemukan. Mohon minta OTP baru." },
        { status: 400 }
      );
    }

    let validOtpRecord = null;
    for (const record of otpRecords.docs) {
      const attemptCount = (record.attemptCount as number) || 0;
      if (isOtpMaxAttemptsReached(attemptCount)) {
        continue;
      }

      const expiresAt = new Date(record.expiresAt as string);
      if (isOtpExpired(expiresAt)) {
        continue;
      }

      const isValid = verifyOtp(otpCode, record.otpHash as string);
      if (isValid) {
        validOtpRecord = record;
        break;
      } else {
        await payload.update({
          collection: COLLECTIONS.OTP_VERIFICATIONS,
          id: record.id as string,
          data: {
            attemptCount: attemptCount + 1,
          },
        });
      }
    }

    if (!validOtpRecord) {
      const allExpiredOrMaxed = otpRecords.docs.every((record) => {
        const attemptCount = (record.attemptCount as number) || 0;
        return isOtpMaxAttemptsReached(attemptCount) || isOtpExpired(new Date(record.expiresAt as string));
      });

      if (allExpiredOrMaxed) {
        return NextResponse.json(
          { error: "Semua kode OTP sudah kadaluarsa atau exceeds batas percobaan. Mohon minta OTP baru." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Kode OTP tidak valid", remainingAttempts: 5 },
        { status: 400 }
      );
    }

    const documentGrants = await payload.find({
      collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
      where: {
        performanceShareLinkId: { equals: linkId },
      },
      limit: 10,
    });

    const matchingGrant = documentGrants.docs.find(
      (g) => g.documentCategory === documentCategory && !(g as unknown as { revokedAt: unknown }).revokedAt
    );

    if (matchingGrant) {
      await payload.update({
        collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
        id: matchingGrant.id as string,
        data: {
          otpVerified: true,
          otpVerifiedAt: new Date(),
        },
      });
    }

    await payload.update({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      id: validOtpRecord.id as string,
      data: {
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Verifikasi berhasil. Dokumen dapat diakses.",
      documentCategory,
      verified: true,
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
