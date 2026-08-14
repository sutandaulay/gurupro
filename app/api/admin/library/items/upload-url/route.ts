/**
 * Admin: Generate presigned upload URL untuk file library
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getLibraryUploadUrl, pdfKey, audiobookKey, coverKey } from "@/lib/r2-library";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);
  if (!session) throw new Error("Unauthorized");
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) throw new Error("Forbidden");
}

export async function POST(request: Request) {
  try {
    await verifyAdmin();
    const body = await request.json();
    const { itemId, fileType } = body; // fileType: 'pdf' | 'audiobook' | 'cover'

    if (!itemId || !fileType) {
      return NextResponse.json({ error: "itemId dan fileType wajib" }, { status: 400 });
    }

    let key: string;
    let contentType: string;

    switch (fileType) {
      case 'pdf':
        key = pdfKey(itemId);
        contentType = 'application/pdf';
        break;
      case 'audiobook':
        key = audiobookKey(itemId);
        contentType = 'audio/mpeg';
        break;
      case 'cover':
        key = coverKey(itemId);
        contentType = 'image/webp';
        break;
      default:
        return NextResponse.json({ error: "fileType tidak valid" }, { status: 400 });
    }

    const uploadUrl = await getLibraryUploadUrl(key, contentType);
    if (!uploadUrl) {
      return NextResponse.json({ error: "Gagal generate upload URL" }, { status: 500 });
    }

    return NextResponse.json({ uploadUrl, key });
  } catch (error: any) {
    console.error("POST /api/admin/library/items/upload-url error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
