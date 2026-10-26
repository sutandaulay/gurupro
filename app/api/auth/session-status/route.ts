import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * POST /api/auth/session-status
 *
 * Checks whether a session identified by its server-side `sid` is still valid
 * (exists in user_sessions and not revoked). Called by the frontend
 * SessionValidator component on mount and on route changes.
 *
 * The HMAC signature in the cookie is validated upstream by middleware
 * (Edge runtime). This endpoint adds a database check for session revocation
 * that cannot be performed at the Edge layer (no pg access there).
 *
 * Request body: { sid: string, sessionId: string }
 * Response:     { valid: boolean, reason?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sid, sessionId } = body as { sid?: string; sessionId?: string };

    if (!sid || typeof sid !== "string") {
      return NextResponse.json(
        { valid: false, reason: "Missing or invalid sid parameter" },
        { status: 400 }
      );
    }

    // Validate sid is a UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sid)) {
      return NextResponse.json(
        { valid: false, reason: "Invalid sid format" },
        { status: 400 }
      );
    }

    // Check: session exists, not expired, not revoked, and matches sessionId column
    const result = await pool.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM user_sessions
       WHERE sid = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [sid]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          valid: false,
          reason: "Session not found, expired, or revoked",
        },
        { status: 200 }
      );
    }

    const session = result.rows[0];

    // Cross-check: if sessionId (the user ID from the cookie) is provided,
    // verify it matches the session's user_id.
    if (sessionId && typeof sessionId === "string") {
      if (session.user_id !== sessionId) {
        return NextResponse.json(
          {
            valid: false,
            reason: "Session user mismatch",
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ valid: true });
  } catch (err: any) {
    console.error("[session-status] Error:", err);
    return NextResponse.json(
      { valid: false, reason: "Server error" },
      { status: 500 }
    );
  }
}
