import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS, OTP_VALIDITY_MINUTES } from "@/collections/config";
import { isShareLinkExpired, isShareLinkRevoked, validateDocumentCategory, generateOtp, hashOtp, getOtpExpiryDate } from "@/lib/performance-share";
import { detectSharedLeader } from "@/lib/detect-shared-leader";
import { getUserById } from "@/lib/db";
import { sendEmailNotification, sendWhatsAppNotification } from "@/lib/notifications";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Token wajib diisi" },
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
        { error: "Link tidak ditemukan atau sudah tidak berlaku" },
        { status: 404 }
      );
    }

    const linkData = shareLink.docs[0];

    if (isShareLinkExpired(linkData.expiresAt as unknown as string)) {
      return NextResponse.json(
        { error: "Link sudah kadaluarsa" },
        { status: 410 }
      );
    }

    if (isShareLinkRevoked(linkData.revokedAt as unknown as string)) {
      return NextResponse.json(
        { error: "Link telah dicabut oleh pengirim" },
        { status: 410 }
      );
    }

    const leaderContact = await payload.findByID({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id: linkData.leaderContactId as string,
    });

    const userData = await getUserById(linkData.teacherId as string);
    const teacherName = userData?.nama_lengkap || "Guru";

    const documentGrants = await payload.find({
      collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
      where: {
        performanceShareLinkId: { equals: linkData.id as string },
      },
      limit: 10,
    });

    const sharedLeaderInfo = await detectSharedLeader(
      leaderContact?.phoneNumber,
      leaderContact?.email
    );

    const otherTeachers = sharedLeaderInfo?.teachers.filter(
      (t) => t.teacherId !== linkData.teacherId
    ) || [];

    await payload.update({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      id: linkData.id as string,
      data: {
        viewCount: ((linkData.viewCount as number) || 0) + 1,
      },
    });

    const grantsData = documentGrants.docs.map((grant) => ({
      id: grant.id,
      documentCategory: grant.documentCategory,
      otpVerified: grant.otpVerified,
      grantedAt: grant.grantedAt,
    }));

    return NextResponse.json({
      teacherName,
      period: getPeriodLabel(),
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/leader-view/${token}`,
      leaderName: leaderContact?.leaderName || "",
      level1: {
        stats: linkData.aggregatedStats || {},
        accessLevel: linkData.accessLevel,
      },
      level2: {
        available: grantsData.length > 0,
        grants: grantsData,
      },
      multiTeacher: {
        hasMultipleTeachers: otherTeachers.length > 0,
        teachers: otherTeachers.map((t) => ({
          teacherId: t.teacherId,
          teacherName: t.teacherName || "Guru",
          token: t.shareLinks?.[0]?.token,
        })),
      },
      isOptedOut: leaderContact?.optedOut || false,
    });
  } catch (error: any) {
    console.error("Performance Share Token GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { action, documentCategory, channel } = body;

    if (action === "grant-access") {
      const payload = await getPayload();

      const shareLink = await payload.find({
        collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
        where: {
          shareToken: { equals: token },
        },
        limit: 1,
      });

      if (shareLink.docs.length === 0) {
        return NextResponse.json({ error: "Link tidak ditemukan" }, { status: 404 });
      }

      const linkData = shareLink.docs[0];
      const shareId = linkData.id as string;

      const categoryValidation = validateDocumentCategory(documentCategory);
      if (!categoryValidation.valid) {
        return NextResponse.json({ error: categoryValidation.reason }, { status: 400 });
      }

      const validChannels = ["whatsapp", "email"];
      if (!channel || !validChannels.includes(channel)) {
        return NextResponse.json({ error: "Channel OTP harus WhatsApp atau Email" }, { status: 400 });
      }

      const leaderContact = await payload.findByID({
        collection: COLLECTIONS.LEADER_CONTACTS,
        id: linkData.leaderContactId as string,
      });

      if (!leaderContact) {
        return NextResponse.json({ error: "Kontak pimpinan tidak ditemukan" }, { status: 404 });
      }

      if (channel === "whatsapp" && !leaderContact.phoneNumber) {
        return NextResponse.json({ error: "Nomor WhatsApp pimpinan tidak tersedia" }, { status: 400 });
      }

      if (channel === "email" && !leaderContact.email) {
        return NextResponse.json({ error: "Email pimpinan tidak tersedia" }, { status: 400 });
      }

      const existingGrants = await payload.find({
        collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
        where: {
          performanceShareLinkId: { equals: shareId },
          documentCategory: { equals: documentCategory },
        },
        limit: 1,
      });

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
        const emailHtml = `<h2>Verifikasi Akses Dokumen GuruPRO AI</h2><p>Kode verifikasi: <strong>${otp}</strong></p><p>Berlaku selama ${OTP_VALIDITY_MINUTES} menit.</p>`;
        await sendEmailNotification(leaderContact.email, "Kode Verifikasi GuruPRO AI", emailHtml);
      }

      let grantId: string | null = null;
      if (existingGrants.docs.length > 0) {
        const updatedGrant = await payload.update({
          collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
          id: existingGrants.docs[0].id as string,
          data: { revokedAt: null, grantedAt: new Date(), otpVerified: false, otpVerifiedAt: null },
        });
        grantId = updatedGrant.id as string;
      } else {
        const newGrant = await payload.create({
          collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
          data: { performanceShareLinkId: shareId, teacherId: linkData.teacherId as string, documentCategory, otpVerified: false, grantedAt: new Date() },
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
    }

    return NextResponse.json({ error: "Action tidak valid" }, { status: 400 });
  } catch (error: any) {
    console.error("Performance Share Token POST error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

function getPeriodLabel(): string {
  const now = new Date();
  const month = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return `Periode ${month}`;
}
