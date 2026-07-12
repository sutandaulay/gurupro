import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS, OTP_VALIDITY_MINUTES } from "@/collections/config";
import { validateDocumentCategory, generateOtp, hashOtp, getOtpExpiryDate } from "@/lib/performance-share";
import { sendEmailNotification, sendWhatsAppNotification } from "@/lib/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shareId } = await params;
    const body = await req.json();
    const { documentCategory, channel } = body;

    const categoryValidation = validateDocumentCategory(documentCategory);
    if (!categoryValidation.valid) {
      return NextResponse.json(
        { error: categoryValidation.reason },
        { status: 400 }
      );
    }

    const validChannels = ["whatsapp", "email"];
    if (!channel || !validChannels.includes(channel)) {
      return NextResponse.json(
        { error: "Channel OTP harus WhatsApp atau Email" },
        { status: 400 }
      );
    }

    const payload = await getPayload();

    const shareLink = await payload.findByID({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      id: shareId,
    });

    if (!shareLink) {
      return NextResponse.json(
        { error: "Share link tidak ditemukan" },
        { status: 404 }
      );
    }

    if ((shareLink as unknown as { teacherId: string }).teacherId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const leaderContact = await payload.findByID({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id: shareLink.leaderContactId as string,
    });

    if (!leaderContact) {
      return NextResponse.json(
        { error: "Kontak pimpinan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (channel === "whatsapp" && !leaderContact.phoneNumber) {
      return NextResponse.json(
        { error: "Nomor WhatsApp pimpinan tidak tersedia untuk OTP" },
        { status: 400 }
      );
    }

    if (channel === "email" && !leaderContact.email) {
      return NextResponse.json(
        { error: "Email pimpinan tidak tersedia untuk OTP" },
        { status: 400 }
      );
    }

    const existingGrants = await payload.find({
      collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
      where: {
        performanceShareLinkId: { equals: shareId },
        documentCategory: { equals: documentCategory },
      },
      limit: 1,
    });

    if (existingGrants.docs.length > 0) {
      const existingGrant = existingGrants.docs[0];
      if (!(existingGrant as unknown as { revokedAt: unknown }).revokedAt) {
        return NextResponse.json(
          { error: "Izin untuk kategori ini sudah ada" },
          { status: 400 }
        );
      }
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = getOtpExpiryDate();
    const sentTo = channel === "whatsapp" ? leaderContact.phoneNumber : leaderContact.email;

    await payload.create({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      data: {
        performanceShareLinkId: shareId,
        otpHash,
        channel,
        sentTo,
        expiresAt,
        attemptCount: 0,
      },
    });

    if (channel === "whatsapp" && leaderContact.phoneNumber) {
      const waMessage = `Kode verifikasi GuruPRO AI untuk mengakses dokumen: ${otp}\n\nKode ini berlaku selama ${OTP_VALIDITY_MINUTES} menit.`;
      await sendWhatsAppNotification(leaderContact.phoneNumber, waMessage);
    } else if (channel === "email" && leaderContact.email) {
      const emailHtml = `
        <h2>Verifikasi Akses Dokumen GuruPRO AI</h2>
        <p>Berikut adalah kode verifikasi untuk mengakses dokumen:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>Kode ini berlaku selama ${OTP_VALIDITY_MINUTES} menit.</p>
        <p>Jika Anda tidak merasa meminta kode ini, abaikan email ini.</p>
      `;
      await sendEmailNotification(
        leaderContact.email,
        "Kode Verifikasi GuruPRO AI",
        emailHtml
      );
    }

    let grantId: string | null = null;
    if (existingGrants.docs.length > 0) {
      const updatedGrant = await payload.update({
        collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
        id: existingGrants.docs[0].id as string,
        data: {
          revokedAt: null,
          grantedAt: new Date(),
          otpVerified: false,
          otpVerifiedAt: null,
        },
      });
      grantId = updatedGrant.id as string;
    } else {
      const newGrant = await payload.create({
        collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
        data: {
          performanceShareLinkId: shareId,
          teacherId: session.id,
          documentCategory,
          otpVerified: false,
          grantedAt: new Date(),
        },
      });
      grantId = newGrant.id as string;
    }

    return NextResponse.json({
      success: true,
      message: `Kode OTP telah dikirim ke ${channel === "whatsapp" ? "WhatsApp" : "email"} pimpinan`,
      otpSentTo: sentTo,
      channel,
      grantId,
      expiresInMinutes: OTP_VALIDITY_MINUTES,
    });
  } catch (error: any) {
    console.error("Grant Document Access error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
