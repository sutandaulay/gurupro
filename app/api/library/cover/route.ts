/**
 * Proxy cover images via signed URL (browser can't access R2 directly with signed creds)
 */

import { NextResponse } from "next/server";
import { getLibrarySignedUrl } from "@/lib/r2-library";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const signedUrl = await getLibrarySignedUrl(key, 86400); // 24h cache
    if (!signedUrl) {
      return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
    }

    // Redirect to signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error("GET /api/library/cover error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
