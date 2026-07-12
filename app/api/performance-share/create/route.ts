import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS, SHARE_LINK_DEFAULT_EXPIRY_DAYS } from "@/collections/config";
import {
  generateShareToken,
  generateShareMessage,
  generateWaMeLink,
  getShareLinkExpiryDate,
} from "@/lib/performance-share";
import { detectSharedLeader, countSharedTeachers } from "@/lib/detect-shared-leader";
import { getUserById } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leaderContactId, aggregatedStats } = body;

    if (!leaderContactId) {
      return NextResponse.json(
        { error: "ID kontak pimpinan wajib diisi" },
        { status: 400 }
      );
    }

    const payload = await getPayload();

    const leaderContact = await payload.findByID({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id: leaderContactId,
    });

    if (!leaderContact) {
      return NextResponse.json(
        { error: "Kontak pimpinan tidak ditemukan" },
        { status: 404 }
      );
    }

    if ((leaderContact as unknown as { teacherId: string }).teacherId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (leaderContact.optedOut) {
      return NextResponse.json(
        { error: "Pimpinan telah memilih untuk tidak menerima link" },
        { status: 400 }
      );
    }

    const shareToken = generateShareToken();
    const expiresAt = getShareLinkExpiryDate(SHARE_LINK_DEFAULT_EXPIRY_DAYS);

    const newShareLink = await payload.create({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      data: {
        teacherId: session.id,
        leaderContactId,
        shareToken,
        accessLevel: "level1_summary_only",
        aggregatedStats: aggregatedStats || {},
        expiresAt,
        viewCount: 0,
      },
    });

    await payload.update({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id: leaderContactId,
      data: {
        lastNotifiedAt: new Date(),
      },
    });

    const userData = await getUserById(session.id);
    const teacherName = userData?.nama_lengkap || "Guru";
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/leader-view/${shareToken}`;

    const shareMessage = generateShareMessage(
      leaderContact.leaderName,
      teacherName,
      shareUrl
    );

    let waMeLink = null;
    if (leaderContact.phoneNumber) {
      waMeLink = generateWaMeLink(leaderContact.phoneNumber, shareMessage);
    }

    const otherTeachersCount = await countSharedTeachers(
      leaderContact.phoneNumber,
      leaderContact.email
    );

    return NextResponse.json({
      success: true,
      shareLink: {
        id: newShareLink.id,
        token: shareToken,
        shareUrl,
        expiresAt,
        waMeLink,
        shareMessage,
      },
      multiTeacherInfo: otherTeachersCount > 1
        ? {
            count: otherTeachersCount,
            message: `${otherTeachersCount - 1} guru lain sudah share ke kontak ini juga. Hubungi GuruPRO untuk paket Institution.`,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Performance Share Create error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
