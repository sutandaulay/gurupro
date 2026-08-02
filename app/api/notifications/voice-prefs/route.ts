import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await query(
      `SELECT voice_briefing_enabled, voice_name_preference
       FROM notification_preferences
       WHERE user_id = $1`,
      [session.id]
    );

    const row = res.rows[0] || {};

    return NextResponse.json({
      voice_briefing_enabled: row.voice_briefing_enabled === true,
      voice_name_preference: row.voice_name_preference || "",
    });
  } catch (error: any) {
    console.error("Voice prefs GET error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { voice_briefing_enabled, voice_name_preference } = body;

    if (typeof voice_briefing_enabled !== "boolean" && voice_name_preference === undefined) {
      return NextResponse.json({ error: "Tidak ada data untuk disimpan" }, { status: 400 });
    }

    const insertValues: any[] = [session.id];
    const updateSets: string[] = [];
    const updateValues: any[] = [];
    let updateIdx = 4;

    if (typeof voice_briefing_enabled === "boolean") {
      insertValues.push(voice_briefing_enabled);
      updateSets.push(`voice_briefing_enabled = $${updateIdx}`);
      updateValues.push(voice_briefing_enabled);
      updateIdx++;
    } else {
      insertValues.push(false);
    }

    if (voice_name_preference !== undefined) {
      insertValues.push(voice_name_preference ? String(voice_name_preference).trim() : null);
      updateSets.push(`voice_name_preference = $${updateIdx}`);
      updateValues.push(voice_name_preference ? String(voice_name_preference).trim() : null);
    } else {
      insertValues.push(null);
    }

    await query(
      `INSERT INTO notification_preferences (user_id, voice_briefing_enabled, voice_name_preference)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET ${updateSets.join(", ")}`,
      [...insertValues, ...updateValues]
    );

    return NextResponse.json({ success: true, message: "Preferensi suara berhasil disimpan" });
  } catch (error: any) {
    console.error("Voice prefs POST error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
