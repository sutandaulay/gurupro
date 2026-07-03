import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;

  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const session = JSON.parse(sessionCookie);
  if (session.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export async function GET(req: Request) {
  try {
    await verifyAdmin();

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "month"; // day, week, month, year, all
    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month");

    // Determine date range based on period
    let dateFilter = "";
    let groupBy = "";
    let dateFormat = "";

    switch (period) {
      case "day":
        dateFilter = `DATE(created_at) = CURRENT_DATE`;
        groupBy = "DATE(created_at)";
        dateFormat = "Day";
        break;
      case "week":
        dateFilter = `created_at >= DATE_TRUNC('week', CURRENT_DATE) AND created_at < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'`;
        groupBy = "DATE_TRUNC('week', created_at)";
        dateFormat = "Week";
        break;
      case "month":
        if (month) {
          dateFilter = `EXTRACT(YEAR FROM created_at) = ${year} AND EXTRACT(MONTH FROM created_at) = ${month}`;
        } else {
          dateFilter = `DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`;
        }
        groupBy = "DATE_TRUNC('day', created_at)";
        dateFormat = "Day";
        break;
      case "year":
        dateFilter = `EXTRACT(YEAR FROM created_at) = ${year}`;
        groupBy = "DATE_TRUNC('month', created_at)";
        dateFormat = "Month";
        break;
      default: // all
        dateFilter = "1=1";
        groupBy = "DATE_TRUNC('month', created_at)";
        dateFormat = "Month";
    }

    // Overview Statistics
    const overviewQuery = `
      SELECT
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'ACTIVATED' THEN 1 END) as activated_count,
        COUNT(CASE WHEN status = 'REFUNDED' THEN 1 END) as refunded_count,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_count,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_count,
        COALESCE(SUM(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric ELSE 0 END), 0)::float as gross_revenue,
        COALESCE(SUM(CASE WHEN status = 'ACTIVATED' THEN amount::numeric ELSE 0 END), 0)::float as net_revenue,
        COALESCE(SUM(CASE WHEN status = 'ACTIVATED' THEN 1 ELSE 0 END), 0) as successful_transactions,
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount::numeric ELSE 0 END), 0)::float as total_refunds,
        COALESCE(AVG(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric END), 0)::float as average_transaction_value
      FROM transactions
      WHERE ${dateFilter}
    `;
    const overviewRes = await query(overviewQuery);
    const overview = overviewRes.rows[0];

    // Calculate conversion rate
    const totalInitiated = parseInt(overview.pending_count) + parseInt(overview.paid_count) + parseInt(overview.activated_count);
    const conversionRate = totalInitiated > 0
      ? ((parseInt(overview.activated_count) / totalInitiated) * 100).toFixed(2)
      : "0.00";

    // Revenue by period (chart data)
    const revenueQuery = `
      SELECT
        ${groupBy === "DATE_TRUNC('month', created_at)" ? "TO_CHAR(" + groupBy + ", 'Mon YYYY')" :
          groupBy === "DATE_TRUNC('day', created_at)" || groupBy === "DATE(created_at)" ? "TO_CHAR(" + (groupBy === "DATE(created_at)" ? groupBy : groupBy) + ", 'DD Mon YYYY')" :
          "TO_CHAR(" + groupBy + ", 'DD Mon YYYY')"} as period,
        COUNT(*) as transaction_count,
        COALESCE(SUM(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric ELSE 0 END), 0)::float as revenue,
        COALESCE(SUM(CASE WHEN status = 'ACTIVATED' THEN amount::numeric ELSE 0 END), 0)::float as net_revenue,
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount::numeric ELSE 0 END), 0)::float as refunds
      FROM transactions
      WHERE ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY ${groupBy}
    `;
    const revenueRes = await query(revenueQuery);

    // Plan distribution
    const planDistQuery = `
      SELECT
        COALESCE(plan_id, 'unknown') as plan_id,
        COUNT(*) as transaction_count,
        COUNT(CASE WHEN status = 'ACTIVATED' THEN 1 END) as successful_count,
        COALESCE(SUM(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric ELSE 0 END), 0)::float as total_revenue,
        COALESCE(AVG(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric END), 0)::float as avg_value
      FROM transactions
      WHERE ${dateFilter}
      GROUP BY COALESCE(plan_id, 'unknown')
      ORDER BY transaction_count DESC
    `;
    const planDistRes = await query(planDistQuery);

    // Payment method distribution
    const paymentMethodQuery = `
      SELECT
        COALESCE(payment_method, 'unknown') as payment_method,
        COUNT(*) as transaction_count,
        COALESCE(SUM(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric ELSE 0 END), 0)::float as total_revenue
      FROM transactions
      WHERE ${dateFilter}
      GROUP BY COALESCE(payment_method, 'unknown')
      ORDER BY transaction_count DESC
    `;
    const paymentMethodRes = await query(paymentMethodQuery);

    // Unpaid/Pending follow-ups needed
    const followUpNeededQuery = `
      SELECT
        COUNT(*) as total_pending,
        COUNT(CASE WHEN created_at < NOW() - INTERVAL '24 hours' THEN 1 END) as overdue_24h,
        COUNT(CASE WHEN created_at < NOW() - INTERVAL '48 hours' THEN 1 END) as overdue_48h,
        COUNT(CASE WHEN created_at < NOW() - INTERVAL '72 hours' THEN 1 END) as overdue_72h
      FROM transactions
      WHERE status = 'PENDING'
    `;
    const followUpRes = await query(followUpNeededQuery);

    // Recent transactions
    const recentTxQuery = `
      SELECT
        t.id, t.external_id, t.amount, t.status, t.payment_method, t.created_at, t.plan_id,
        u.email, u.nama_lengkap, u.whatsapp
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `;
    const recentRes = await query(recentTxQuery);

    // Top customers by revenue
    const topCustomersQuery = `
      SELECT
        u.id as user_id,
        u.email,
        u.nama_lengkap,
        u.whatsapp,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(CASE WHEN t.status IN ('PAID', 'ACTIVATED') THEN t.amount::numeric ELSE 0 END), 0)::float as total_spent,
        MAX(t.created_at) as last_transaction
      FROM users u
      JOIN transactions t ON t.user_id = u.id
      WHERE ${dateFilter}
      GROUP BY u.id, u.email, u.nama_lengkap, u.whatsapp
      HAVING SUM(CASE WHEN t.status IN ('PAID', 'ACTIVATED') THEN t.amount::numeric ELSE 0 END) > 0
      ORDER BY total_spent DESC
      LIMIT 10
    `;
    const topCustomersRes = await query(topCustomersQuery);

    return NextResponse.json({
      overview: {
        ...overview,
        conversion_rate: parseFloat(conversionRate),
        pending_amount: 0 // Calculated separately if needed
      },
      revenue_chart: revenueRes.rows,
      plan_distribution: planDistRes.rows,
      payment_methods: paymentMethodRes.rows,
      follow_up_needed: followUpRes.rows[0],
      recent_transactions: recentRes.rows,
      top_customers: topCustomersRes.rows
    });
  } catch (error: any) {
    console.error("Admin Finance Stats error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}