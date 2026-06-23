import { getPricingConfig } from "@/lib/settings";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const config = await getPricingConfig();
    return NextResponse.json(config);
  } catch (error: any) {
    console.error("GET pricing config error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
