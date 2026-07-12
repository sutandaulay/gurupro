import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS } from "@/collections/config";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ shareId: string; grantId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shareId, grantId } = await params;

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

    const grant = await payload.findByID({
      collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
      id: grantId,
    });

    if (!grant) {
      return NextResponse.json(
        { error: "Izin dokumen tidak ditemukan" },
        { status: 404 }
      );
    }

    if ((grant as unknown as { performanceShareLinkId: string }).performanceShareLinkId !== shareId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if ((grant as unknown as { teacherId: string }).teacherId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await payload.update({
      collection: COLLECTIONS.DOCUMENT_ACCESS_GRANTS,
      id: grantId,
      data: {
        revokedAt: new Date(),
        otpVerified: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Izin akses dokumen berhasil dicabut",
    });
  } catch (error: any) {
    console.error("Revoke Document Access error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
