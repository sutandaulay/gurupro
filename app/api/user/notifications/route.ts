import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseSessionCookie } from "@/lib/session-sign";

/**
 * User Notifications API
 *
 * GET: Fetch user's in-app notifications
 * PUT: Mark notification(s) as read
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const includeRead = searchParams.get("includeRead") === "true";

    // Get user ID from session cookie
    const cookieStore = await import("next/headers").then(m => m.cookies());
    const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.id;

    // Fetch notifications
    const whereClause = includeRead ? "" : "AND is_read = false";
    const result = await query(
      `SELECT id, title, body, type, is_read, created_at, reference_type, reference_id
       FROM in_app_notifications
       WHERE user_id = $1 ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    // Get unread count
    const countRes = await query(
      "SELECT COUNT(*) as count FROM in_app_notifications WHERE user_id = $1 AND is_read = false",
      [userId]
    );

    const unreadCount = parseInt(countRes.rows[0]?.count || "0");

    return NextResponse.json({
      notifications: result.rows,
      unreadCount,
      total: result.rows.length,
    });
  } catch (error: any) {
    console.error("GET notifications error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // Get user ID from session cookie
    const cookieStore = await import("next/headers").then(m => m.cookies());
    const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.id;

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      await query(
        "UPDATE in_app_notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
        [userId]
      );
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (notificationId) {
      await query(
        "UPDATE in_app_notifications SET is_read = true WHERE id = $1 AND user_id = $2",
        [notificationId, userId]
      );
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json({ error: "notificationId or markAllRead is required" }, { status: 400 });
  } catch (error: any) {
    console.error("PUT notification error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
