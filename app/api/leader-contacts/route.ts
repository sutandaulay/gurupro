import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPayload } from "@/lib/payload";
import { COLLECTIONS } from "@/collections/config";
import { normalizePhoneNumber, normalizeEmail } from "@/lib/performance-share";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload();

    const leaderContacts = await payload.find({
      collection: COLLECTIONS.LEADER_CONTACTS,
      where: {
        teacherId: { equals: session.id },
      },
      sort: "-createdAt",
      limit: 50,
    });

    return NextResponse.json({
      leaderContacts: leaderContacts.docs.map((contact) => ({
        id: contact.id,
        leaderName: contact.leaderName,
        leaderRole: contact.leaderRole,
        phoneNumber: contact.phoneNumber,
        email: contact.email,
        schoolNameRaw: contact.schoolNameRaw,
        optedOut: contact.optedOut,
        createdAt: contact.createdAt,
        lastNotifiedAt: contact.lastNotifiedAt,
      })),
    });
  } catch (error: any) {
    console.error("Leader Contacts GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leaderName, leaderRole, phoneNumber, email, schoolNameRaw } = body;

    if (!leaderName || !leaderRole) {
      return NextResponse.json(
        { error: "Nama pimpinan dan jabatan wajib diisi" },
        { status: 400 }
      );
    }

    const validRoles = ["kepala_sekolah", "pengawas", "wali_kelas", "lainnya"];
    if (!validRoles.includes(leaderRole)) {
      return NextResponse.json(
        { error: "Jabatan tidak valid" },
        { status: 400 }
      );
    }

    const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
    const normalizedEmail = email ? normalizeEmail(email) : null;

    if (!normalizedPhone && !normalizedEmail) {
      return NextResponse.json(
        { error: "Minimal salah satu dari WhatsApp atau Email wajib diisi" },
        { status: 400 }
      );
    }

    const payload = await getPayload();

    const newContact = await payload.create({
      collection: COLLECTIONS.LEADER_CONTACTS,
      data: {
        teacherId: session.id,
        leaderName: leaderName.trim(),
        leaderRole,
        phoneNumber: normalizedPhone,
        email: normalizedEmail,
        schoolNameRaw: schoolNameRaw?.trim() || null,
        optedOut: false,
      },
    });

    return NextResponse.json({
      success: true,
      leaderContact: {
        id: newContact.id,
        leaderName: newContact.leaderName,
        leaderRole: newContact.leaderRole,
        phoneNumber: newContact.phoneNumber,
        email: newContact.email,
        schoolNameRaw: newContact.schoolNameRaw,
      },
    });
  } catch (error: any) {
    console.error("Leader Contacts POST error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, leaderName, leaderRole, phoneNumber, email, schoolNameRaw } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID kontak pimpinan wajib diisi" },
        { status: 400 }
      );
    }

    const payload = await getPayload();

    const existingContact = await payload.findByID({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id,
    });

    if ((existingContact as unknown as { teacherId: string }).teacherId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;
    const normalizedEmail = email ? normalizeEmail(email) : null;

    if (!normalizedPhone && !normalizedEmail) {
      return NextResponse.json(
        { error: "Minimal salah satu dari WhatsApp atau Email wajib diisi" },
        { status: 400 }
      );
    }

    const updatedContact = await payload.update({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id,
      data: {
        leaderName: leaderName?.trim(),
        leaderRole,
        phoneNumber: normalizedPhone,
        email: normalizedEmail,
        schoolNameRaw: schoolNameRaw?.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      leaderContact: {
        id: updatedContact.id,
        leaderName: updatedContact.leaderName,
        leaderRole: updatedContact.leaderRole,
        phoneNumber: updatedContact.phoneNumber,
        email: updatedContact.email,
        schoolNameRaw: updatedContact.schoolNameRaw,
      },
    });
  } catch (error: any) {
    console.error("Leader Contacts PUT error:", error);
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
        { error: "ID kontak pimpinan wajib diisi" },
        { status: 400 }
      );
    }

    const payload = await getPayload();

    const existingContact = await payload.findByID({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id,
    });

    if ((existingContact as unknown as { teacherId: string }).teacherId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await payload.delete({
      collection: COLLECTIONS.LEADER_CONTACTS,
      id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Leader Contacts DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
