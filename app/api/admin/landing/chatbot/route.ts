import { getPayload } from "@/lib/payload";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const session = JSON.parse(sessionCookie);
  if (session.role !== "admin") throw new Error("Forbidden");
}

// Helper to save to database cache
async function saveToDbCache(key: string, value: any) {
  try {
    await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
    return true;
  } catch (e) {
    console.error("Failed to save to db cache:", e);
    return false;
  }
}

export async function GET() {
  try {
    // Try Payload CMS first
    try {
      const payload = await getPayload();
      const chatbot = await payload.findGlobal({ slug: "chatbot-config", depth: 0 });

      // Update cache
      await saveToDbCache("landing_chatbot", chatbot);

      return NextResponse.json(chatbot);
    } catch {
      // Fallback to database cache
      const cacheRes = await query(
        "SELECT key, value FROM system_settings WHERE key = 'landing_chatbot'"
      );

      if (cacheRes.rows.length > 0) {
        try {
          const val = cacheRes.rows[0].value;
          return NextResponse.json(typeof val === "string" ? JSON.parse(val) : val);
        } catch {
          return NextResponse.json({});
        }
      }

      return NextResponse.json({});
    }
  } catch (error: any) {
    console.error("GET chatbot error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await verifyAdmin();
    const body = await req.json();

    // Save to Payload CMS
    let payloadSuccess = false;
    try {
      const payload = await getPayload();
      await payload.updateGlobal({ slug: "chatbot-config", data: body });
      payloadSuccess = true;
    } catch (e) {
      console.error("Payload update failed:", e);
    }

    // Always save to database cache
    const dbSuccess = await saveToDbCache("landing_chatbot", body);

    if (payloadSuccess || dbSuccess) {
      return NextResponse.json({ success: true, savedTo: payloadSuccess ? "payload" : "cache" });
    }

    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  } catch (error: any) {
    console.error("PUT chatbot error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
