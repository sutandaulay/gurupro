import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS } from "@/collections/config";
import { normalizePhoneNumber, normalizeEmail } from "@/lib/performance-share";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phoneNumber, email } = body;

    if (!phoneNumber && !email) {
      return NextResponse.json(
        { error: "Nomor WhatsApp atau Email wajib diisi" },
        { status: 400 }
      );
    }

    const payload = await getPayload();

    const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
    const normalizedEmail = email ? normalizeEmail(email) : null;

    const orConditions: Record<string, unknown>[] = [];
    if (normalizedPhone) {
      orConditions.push({ phoneNumber: { equals: normalizedPhone } });
    }
    if (normalizedEmail) {
      orConditions.push({ email: { equals: normalizedEmail } });
    }

    const leaderContacts = await payload.find({
      collection: COLLECTIONS.LEADER_CONTACTS,
      where: {
        or: orConditions,
      },
      limit: 100,
    });

    if (leaderContacts.docs.length === 0) {
      return NextResponse.json(
        { error: "Kontak tidak ditemukan" },
        { status: 404 }
      );
    }

    let updatedCount = 0;
    for (const contact of leaderContacts.docs) {
      if (!(contact as unknown as { optedOut: boolean }).optedOut) {
        await payload.update({
          collection: COLLECTIONS.LEADER_CONTACTS,
          id: contact.id as string,
          data: {
            optedOut: true,
            optedOutAt: new Date(),
          },
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Anda berhasil berhenti menerima link. ${updatedCount} kontak telah diperbarui.`,
      updatedCount,
    });
  } catch (error: any) {
    console.error("Opt-out error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
