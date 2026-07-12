import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS } from "@/collections/config";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const leaderContactId = searchParams.get("leaderContactId");

    const payload = await getPayload();

    const where: Record<string, unknown> = {
      teacherId: { equals: session.id },
    };

    if (leaderContactId) {
      where.leaderContactId = { equals: leaderContactId };
    }

    const shareLinks = await payload.find({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      where,
      sort: "-createdAt",
      limit: 50,
    });

    return NextResponse.json({
      shareLinks: shareLinks.docs.map((link) => ({
        id: link.id,
        leaderContactId: link.leaderContactId,
        shareToken: link.shareToken,
        accessLevel: link.accessLevel,
        aggregatedStats: link.aggregatedStats,
        expiresAt: link.expiresAt,
        revokedAt: link.revokedAt,
        viewCount: link.viewCount,
        createdAt: link.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Performance Share GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID share link wajib diisi" },
        { status: 400 }
      );
    }

    const payload = await getPayload();

    const shareLink = await payload.findByID({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      id,
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

    await payload.update({
      collection: COLLECTIONS.PERFORMANCE_SHARE_LINKS,
      id,
      data: {
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Performance Share DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
