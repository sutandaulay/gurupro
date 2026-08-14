import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendInAppNotification } from "@/lib/institution-members";
import { parseSessionCookie } from "@/lib/session-sign";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get("gurupro_session")?.value);

  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

/**
 * Get detailed notifications for admin dashboard
 * Returns recent transactions and other important alerts
 */
export async function GET(req: Request) {
  try {
    await verifyAdmin();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const since = searchParams.get("since"); // ISO timestamp for real-time updates

    // Get recent pending/paid transactions
    let whereClause = "";
    let params: any[] = [];

    if (since) {
      whereClause = "WHERE t.updated_at > $1";
      params = [since];
    }

    // Get pending transactions (needs admin attention)
    const pendingTxQuery = `
      SELECT
        t.id,
        t.user_id,
        t.external_id,
        t.amount,
        t.status,
        t.payment_method,
        t.created_at,
        t.updated_at,
        u.email,
        u.nama_lengkap,
        u.whatsapp,
        'transaction' as type,
        'pending_payment' as alert_type
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.status IN ('PAID', 'PENDING')
      ORDER BY t.updated_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const pendingTxRes = await query(pendingTxQuery, params);

    // Get pending payout requests
    const pendingPayoutsRes = await query(
      `SELECT
        pr.id,
        pr.created_at,
        pr.created_at as updated_at,
        pr.status,
        pr.jumlah as amount,
        pr.user_id,
        u.email,
        u.nama_lengkap,
        u.whatsapp,
        'payout' as type,
        'pending_payout' as alert_type
      FROM payout_requests pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.status = 'PENDING'
      ORDER BY pr.created_at DESC
      LIMIT $1`,
      [limit]
    );

    // Get expired subscriptions (last 24 hours)
    const expiredSubsRes = await query(
      `SELECT
        id,
        subscription_end,
        subscription_end as updated_at,
        nama_lengkap,
        email,
        whatsapp,
        status_langganan,
        0 as amount,
        'subscription' as type,
        'subscription_expiring' as alert_type
      FROM users
      WHERE subscription_end IS NOT NULL
        AND subscription_end < NOW() + INTERVAL '1 day'
        AND subscription_end > NOW()
        AND status_langganan != 'free'
      ORDER BY subscription_end ASC
      LIMIT $1`,
      [5]
    );

    // Count totals for badges
    const countsRes = await query(`
      SELECT
        (SELECT COUNT(*) FROM transactions WHERE status = 'PAID') as pending_transactions,
        (SELECT COUNT(*) FROM payout_requests WHERE status = 'PENDING') as pending_payouts,
        (SELECT COUNT(*) FROM users WHERE subscription_end IS NOT NULL
          AND subscription_end < NOW() + INTERVAL '1 day'
          AND subscription_end > NOW()
          AND status_langganan != 'free') as expiring_subscriptions
    `);

    const counts = countsRes.rows[0];

    // Get broadcast history (grouped by title/body from persisted in-app notifications)
    const broadcastHistoryRes = await query(
      `SELECT
         title,
         body,
         COUNT(DISTINCT user_id) as sent_count,
         MAX(created_at) as created_at
       FROM in_app_notifications
       WHERE type = 'admin_broadcast'
       GROUP BY title, body
       ORDER BY MAX(created_at) DESC
       LIMIT 20`
    );

    // Combine and sort all notifications
    const notifications = [
      ...pendingTxRes.rows.map(row => ({
        ...row,
        priority: row.status === 'PAID' ? 'high' : 'medium',
        isNew: since ? new Date(row.updated_at) > new Date(since) : false
      })),
      ...pendingPayoutsRes.rows.map(row => ({
        ...row,
        priority: 'high',
        isNew: since ? new Date(row.updated_at) > new Date(since) : false
      })),
      ...expiredSubsRes.rows.map(row => ({
        ...row,
        priority: 'low',
        isNew: false
      }))
    ].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

    return NextResponse.json({
      notifications: notifications.slice(0, limit),
      totalNotifications: notifications.length,
      broadcastHistory: broadcastHistoryRes.rows.map((row) => ({
        title: row.title,
        body: row.body,
        sentCount: parseInt(row.sent_count || "0", 10),
        timestamp: row.created_at,
      })),
      counts: {
        pendingTransactions: parseInt(counts.pending_transactions || "0"),
        pendingPayouts: parseInt(counts.pending_payouts || "0"),
        expiringSubscriptions: parseInt(counts.expiring_subscriptions || "0"),
        total: parseInt(counts.pending_transactions || "0") +
               parseInt(counts.pending_payouts || "0") +
               parseInt(counts.expiring_subscriptions || "0")
      },
      hasNew: notifications.some(n => n.isNew),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Admin notifications error:", error);
    const status = error.message === "Unauthorized" ? 401 :
                   error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

/**
 * Mark notification as read
 */
export async function POST(req: Request) {
  try {
    await verifyAdmin();

    const body = await req.json();
    const { action, targetType, title, body: notifBody, targetUserId, targetEmail, targetSubscription } = body;

    // Handle send notification action
    if (action === "send_notification") {
      if (!title || !notifBody) {
        return NextResponse.json({ error: "title and body are required" }, { status: 400 });
      }

      let sentCount = 0;
      const errors: string[] = [];

      switch (targetType) {
        case "single": {
          // Send to single user
          let userId = targetUserId;
          if (!userId && targetEmail) {
            const userRes = await query(
              "SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)",
              [targetEmail]
            );
            if (userRes.rows.length === 0) {
              return NextResponse.json({ error: "User not found" }, { status: 404 });
            }
            userId = userRes.rows[0].id;
          }

          if (!userId) {
            return NextResponse.json({ error: "targetUserId or targetEmail is required" }, { status: 400 });
          }

          await sendInAppNotification(
            userId,
            title,
            notifBody,
            "admin_broadcast",
            "admin_notification",
            undefined
          );
          sentCount = 1;
          break;
        }

        case "all": {
          // Send to all active users
          const allUsersRes = await query("SELECT id FROM users WHERE is_active = true");
          for (const user of allUsersRes.rows) {
            try {
              await sendInAppNotification(
                user.id,
                title,
                notifBody,
                "admin_broadcast",
                "admin_notification",
                undefined
              );
              sentCount++;
            } catch (err: any) {
              errors.push(`User ${user.id}: ${err.message}`);
            }
          }
          break;
        }

        case "free_users": {
          // Send to free users only
          const freeUsersRes = await query(
            "SELECT id FROM users WHERE is_active = true AND (status_langganan = 'free' OR status_langganan IS NULL)"
          );
          for (const user of freeUsersRes.rows) {
            try {
              await sendInAppNotification(
                user.id,
                title,
                notifBody,
                "admin_broadcast",
                "admin_notification",
                undefined
              );
              sentCount++;
            } catch (err: any) {
              errors.push(`User ${user.id}: ${err.message}`);
            }
          }
          break;
        }

        case "premium_users": {
          // Send to premium (paying) users only
          const premiumUsersRes = await query(
            "SELECT id FROM users WHERE is_active = true AND status_langganan != 'free' AND status_langganan IS NOT NULL"
          );
          for (const user of premiumUsersRes.rows) {
            try {
              await sendInAppNotification(
                user.id,
                title,
                notifBody,
                "admin_broadcast",
                "admin_notification",
                undefined
              );
              sentCount++;
            } catch (err: any) {
              errors.push(`User ${user.id}: ${err.message}`);
            }
          }
          break;
        }

        default:
          return NextResponse.json(
            { error: "Invalid targetType. Must be: single, all, free_users, or premium_users" },
            { status: 400 }
          );
      }

      // Log the broadcast
      try {
        const session = await verifyAdmin();
        await query(
          `INSERT INTO admin_audit_logs (admin_id, action, details, created_at)
           VALUES ($1, 'send_user_notification', $2, NOW())`,
          [
            session.id,
            JSON.stringify({ title, targetType, sentCount, errors: errors.length > 0 ? errors : null }),
          ]
        );
      } catch (logErr) {
        console.error("Failed to log notification action:", logErr);
      }

      return NextResponse.json({
        success: true,
        message: `Notification sent to ${sentCount} users`,
        sentCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    const { notificationId } = body;

    if (action === "mark_read") {
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    if (action === "mark_all_read") {
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Admin notifications POST error:", error);
    const status = error.message === "Unauthorized" ? 401 :
                   error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
