import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "next-auth/react";
import { parseSignedSession } from "@/lib/session-sign";

async function revokeAndClear() {
  const cookieStore = await cookies();

  // Revoke the server-side session (if the cookie carries a sid)
  try {
    const raw = cookieStore.get("gurupro_session")?.value;
    const session = parseSignedSession(raw);
    if (session?.sid) {
      const { query } = await import("@/lib/db");
      await query(
        `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE sid = $1 AND revoked_at IS NULL`,
        [session.sid]
      );
    }
  } catch (err) {
    console.error("Logout revocation failed:", err);
  }

  // Clear our custom session cookies
  cookieStore.delete("gurupro_session");
  cookieStore.delete("gurupro_school_selected");

  // Clear NextAuth session cookies for Google OAuth users
  cookieStore.delete("next-auth.session-token");
  cookieStore.delete("__Secure-next-auth.session-token");
}

export async function POST() {
  await revokeAndClear();
  return NextResponse.json({ success: true });
}

// Also add GET method for NextAuth signout compatibility
export async function GET() {
  await revokeAndClear();
  return NextResponse.json({ success: true });
}