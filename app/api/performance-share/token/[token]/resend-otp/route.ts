import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS, OTP_VALIDITY_MINUTES, OTP_RESEND_RATE_LIMIT_PER_HOUR } from "@/collections/config";
import { generateOtp, hashOtp, getOtpExpiryDate } from "@/lib/performance-share";
import { sendEmailNotification, sendWhatsAppNotification } from "@/lib/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { channel } = body;

    if (!channel || !["whatsapp", "email"].includes(channel)) {
      return NextResponse.json(
        { error: "Channel OTP harus WhatsApp atau Email" },
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

    const recentOtps = await payload.find({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      where: {
        performanceShareLinkId: { equals: linkId },
        channel: { equals: channel },
      },
      sort: "-createdAt",
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
          {
            error: `Terlalu banyak permintaan. Maksimal ${OTP_RESEND_RATE_LIMIT_PER_HOUR}x per jam.`,
            retryAfter: "1 jam",
          },
          { status: 429 }
        );
      }
    }

    const leaderContact = await payload.findByID({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id: shareLink.docs[0].leaderContactId as string,
    });

    if (!leaderContact) {
      return NextResponse.json(
        { error: "Kontak pimpinan tidak ditemukan" },
        { status: 404 }
      );
    }

    const sentTo = channel === "whatsapp" ? leaderContact.phoneNumber : leaderContact.email;
    if (!sentTo) {
      return NextResponse.json(
        { error: `${channel === "whatsapp" ? "Nomor WhatsApp" : "Email"} pimpinan tidak tersedia` },
        { status: 400 }
      );
    }

    const newOtp = generateOtp();
    const newOtpHash = hashOtp(newOtp);
    const expiresAt = getOtpExpiryDate();

    await payload.updateMany({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      where: {
        performanceShareLinkId: { equals: linkId },
        verifiedAt: { equals: null },
      },
      data: {
        expiresAt: new Date(),
      },
    });

    await payload.create({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      data: {
        performanceShareLinkId: linkId,
        otpHash: newOtpHash,
        channel,
        sentTo,
        expiresAt,
        attemptCount: 0,
      },
    });

    if (channel === "whatsapp" && leaderContact.phoneNumber) {
      const waMessage = `Kode verifikasi baru GuruPRO AI: ${newOtp}\n\nBerlaku ${OTP_VALIDITY_MINUTES} menit.`;
      await sendWhatsAppNotification(leaderContact.phoneNumber, waMessage);
    } else if (channel === "email" && leaderContact.email) {
      const emailHtml = `
        <h2>Kode Verifikasi Baru GuruPRO AI</h2>
        <p>Berikut adalah kode verifikasi baru:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${newOtp}</p>
        <p>Berlaku selama ${OTP_VALIDITY_MINUTES} menit.</p>
        <p>Jika Anda tidak merasa minta kode ini, abaikan email ini.</p>
      `;
      await sendEmailNotification(
        leaderContact.email,
        "Kode Verifikasi Baru GuruPRO AI",
        emailHtml
      );
    }

    return NextResponse.json({
      success: true,
      message: `Kode OTP baru telah dikirim ke ${channel === "whatsapp" ? "WhatsApp" : "email"}`,
      channel,
      expiresInMinutes: OTP_VALIDITY_MINUTES,
    });
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
