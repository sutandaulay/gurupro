import { getAppBrandingConfig } from "@/lib/settings";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const branding = await getAppBrandingConfig();
    return NextResponse.json(branding);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
