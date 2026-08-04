import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendEventNotification } from "@/lib/notifications";
import { activateTransaction } from "@/lib/payments";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gurupro_session")?.value;

  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const session = JSON.parse(sessionCookie);
  if (!['admin', 'super_admin', 'manager'].includes(session.role)) {
    throw new Error("Forbidden");
  }
}

export async function GET(req: Request) {
  try {
    await verifyAdmin();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") || "DESC";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const includeStats = searchParams.get("includeStats") === "true";

    const offset = (page - 1) * limit;

    // Validasi sort column untuk keamanan
    const allowedSortColumns = ["created_at", "amount", "status", "email", "nama_lengkap"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Build WHERE clause
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      whereConditions.push(`(
        u.email ILIKE $${paramIndex}
        OR u.nama_lengkap ILIKE $${paramIndex}
        OR t.id::text ILIKE $${paramIndex}
        OR t.external_id ILIKE $${paramIndex}
        OR u.whatsapp ILIKE $${paramIndex}
      )`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`DATE(t.created_at) >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`DATE(t.created_at) <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ${whereClause}
    `;
    const countRes = await query(countQuery, params);
    const totalRecords = parseInt(countRes.rows[0].total);
    const totalPages = Math.ceil(totalRecords / limit);

    // Main query with pagination
    const txQuery = `
      SELECT t.id, t.user_id, t.external_id, t.amount, t.status, t.payment_method,
             t.created_at, t.plan_id, t.updated_at,
             u.email, u.nama_lengkap, u.whatsapp
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ${whereClause}
      ORDER BY t.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const txRes = await query(txQuery, params);

    // Get statistics if requested
    let stats = null;
    if (includeStats) {
      const statsQuery = `
        SELECT
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
          COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount::numeric ELSE 0 END), 0) as pending_amount,
          COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status = 'ACTIVATED' THEN 1 END) as activated_count,
          COUNT(CASE WHEN status = 'REFUNDED' THEN 1 END) as refunded_count,
          COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_count,
          COALESCE(SUM(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric ELSE 0 END), 0) as gross_revenue,
          COALESCE(SUM(CASE WHEN status = 'ACTIVATED' THEN amount::numeric ELSE 0 END), 0) as net_revenue,
          COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount::numeric ELSE 0 END), 0) as total_refunds,
          COUNT(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN 1 END) as successful_transactions,
          COALESCE(ROUND(AVG(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric END)::numeric, 2), 0) as average_transaction_value,
          COALESCE(ROUND(100.0 * COUNT(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN 1 END) / NULLIF(COUNT(*), 0)::numeric, 2), 0) as conversion_rate
        FROM transactions t
        JOIN users u ON t.user_id = u.id
      `;
      const statsRes = await query(statsQuery);
      stats = statsRes.rows[0];

      // Get monthly stats for current year
      const monthlyStatsQuery = `
        SELECT
          DATE_TRUNC('month', t.created_at) as month,
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN status IN ('PAID', 'ACTIVATED') THEN amount::numeric ELSE 0 END), 0) as revenue
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE DATE_TRUNC('year', t.created_at) = DATE_TRUNC('year', NOW())
        GROUP BY DATE_TRUNC('month', t.created_at)
        ORDER BY month
      `;
      const monthlyRes = await query(monthlyStatsQuery);

      // Get plan distribution
      const planDistQuery = `
        SELECT
          plan_id,
          COUNT(*) as count,
          COALESCE(SUM(amount::numeric), 0) as total_amount
        FROM transactions
        WHERE status IN ('PAID', 'ACTIVATED') AND plan_id IS NOT NULL
        GROUP BY plan_id
        ORDER BY count DESC
      `;
      const planDistRes = await query(planDistQuery);

      stats.monthly_data = monthlyRes.rows;
      stats.plan_distribution = planDistRes.rows;
    }

    return NextResponse.json({
      transactions: txRes.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      stats
    });
  } catch (error: any) {
    console.error("Admin Transactions GET error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin();

    const body = await req.json();
    const { transactionId, action, followUpType, followUpMessage, followUpChannel } = body;

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }

    // Retrieve transaction
    const txRes = await query("SELECT * FROM transactions WHERE id = $1", [transactionId]);
    if (txRes.rows.length === 0) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    const transaction = txRes.rows[0];

    // Get user data
    const userRes = await query(
      "SELECT email, nama_lengkap, whatsapp FROM users WHERE id = $1",
      [transaction.user_id]
    );
    const user = userRes.rows[0];

    if (action === "activate") {
      if (transaction.status !== "PENDING" && transaction.status !== "PAID") {
        return NextResponse.json({ error: "Hanya transaksi berstatus PENDING atau PAID yang dapat diaktifkan" }, { status: 400 });
      }

      // Untuk transaksi PENDING, verifikasi dulu ke gateway agar tidak salah aktif
      if (transaction.status === "PENDING") {
        const pgRes = await query("SELECT value FROM system_settings WHERE key = 'payment_gateway'");
        const pgConfig = pgRes.rows[0]?.value || {};
        const gateway = pgConfig.default_gateway || "mock";

        if (gateway === "xendit" && pgConfig.xendit?.api_key && transaction.external_id) {
          try {
            const authHeader = Buffer.from(pgConfig.xendit.api_key + ":").toString("base64");
            const invRes = await fetch(
              `https://api.xendit.co/v2/invoices/${encodeURIComponent(transaction.external_id)}`,
              { method: "GET", headers: { Authorization: `Basic ${authHeader}` } }
            );
            if (invRes.ok) {
              const inv = await invRes.json();
              if (inv.status !== "PAID" && inv.status !== "SETTLED") {
                return NextResponse.json(
                  { error: `Invoice Xendit belum dibayar (status: ${inv.status}). Tidak dapat diaktifkan.` },
                  { status: 400 }
                );
              }
            } else {
              const invErr = await invRes.json().catch(() => ({}));
              return NextResponse.json(
                { error: `Gagal verifikasi Xendit: ${invErr.message || invRes.status}` },
                { status: 502 }
              );
            }
          } catch (e: any) {
            return NextResponse.json({ error: `Error verifikasi Xendit: ${e.message}` }, { status: 500 });
          }
        }

        // Tandai sebagai PAID sebelum aktivasi (webhook mungkin terlewat)
        await query("UPDATE transactions SET status = 'PAID', updated_at = NOW() WHERE id = $1", [transactionId]);
      }

      const res = await activateTransaction(transactionId);
      if (!res.success) {
        return NextResponse.json({ error: "Gagal mengaktifkan paket" }, { status: 400 });
      }

      // Send notification
      await sendEventNotification("payment_success", user.email, {
        nama_lengkap: user.nama_lengkap,
        email: user.email,
        amount: transaction.amount,
        plan_name: transaction.plan_id,
        payment_method: transaction.payment_method || "Manual Activation",
        tokens_added: "5000"
      });

      return NextResponse.json({ success: true, message: "Paket berhasil diaktifkan untuk pengguna." });

    } else if (action === "follow_up") {
      // Follow-up action
      if (!["email", "whatsapp", "both"].includes(followUpChannel)) {
        return NextResponse.json({ error: "Channel follow-up tidak valid" }, { status: 400 });
      }

      if (!followUpMessage) {
        return NextResponse.json({ error: "Pesan follow-up wajib diisi" }, { status: 400 });
      }

      // Get template for follow-up
      const templateQuery = `
        SELECT value FROM system_settings WHERE key = 'templates'
      `;
      const templateRes = await query(templateQuery);
      const templates = templateRes.rows[0]?.value || {};

      // Default follow-up message if no template
      const defaultEmailSubject = `Pengingat Pembayaran GuruPRO - Invoice #${transaction.external_id}`;
      const           defaultWaMessage = `Halo ${user.nama_lengkap},\n\nKami dari GuruPRO ingin mengingatkan bahwa pembayaran untuk paket premium Anda dengan invoice #${transaction.external_id} sebesar Rp ${Number(transaction.amount).toLocaleString("id-ID")} masih belum diselesaikan.\n\nMohon segera menyelesaikan pembayaran untuk menikmati fitur premium GuruPRO.\n\nTerima kasih.\n\nSalam,\nTim GuruPRO`;

      const emailSubject = followUpMessage.emailSubject || defaultEmailSubject;
      const emailBody = followUpMessage.emailBody || defaultWaMessage;
      const waMessageContent = followUpMessage.waMessage || defaultWaMessage;

      const followUpResults: any = { channel: followUpChannel };

      // Send Email
      if (followUpChannel === "email" || followUpChannel === "both") {
        try {
          const emailConfigRes = await query(
            "SELECT value FROM system_settings WHERE key = 'email_sender'"
          );
          const emailConfig = emailConfigRes.rows[0]?.value || {};

          if (emailConfig.active) {
            // Import nodemailer dynamically
            const nodemailer = await import("nodemailer");
            const transporter = nodemailer.default.createTransport({
              host: emailConfig.smtp?.host,
              port: emailConfig.smtp?.port || 587,
              secure: emailConfig.smtp?.secure,
              auth: {
                user: emailConfig.smtp?.user,
                pass: emailConfig.smtp?.pass
              }
            });

            await transporter.sendMail({
              from: `"${emailConfig.sender_name || "GuruPRO"}" <${emailConfig.sender_email}>`,
              to: user.email,
              subject: emailSubject,
              html: emailBody.replace(/\n/g, "<br>")
            });
            followUpResults.email = { success: true, sent: true };
          } else {
            followUpResults.email = { success: false, reason: "Email sender not active" };
          }
        } catch (emailError: any) {
          console.error("Follow-up email error:", emailError);
          followUpResults.email = { success: false, reason: emailError.message };
        }
      }

      // Send WhatsApp
      if (followUpChannel === "whatsapp" || followUpChannel === "both") {
        try {
          const waConfigRes = await query(
            "SELECT value FROM system_settings WHERE key = 'wa_sender'"
          );
          const waConfig = waConfigRes.rows[0]?.value || {};

          if (waConfig.active) {
            const waEndpoint = waConfig.provider === "fonnte"
              ? "https://api.fonnte.com/api/send-message"
              : "https://api.ruangwa.com/v1/send";

            const waHeaders: any = {
              "Content-Type": "application/json"
            };

            if (waConfig.provider === "fonnte") {
              waHeaders["Authorization"] = waConfig.fonnte?.token;
            } else {
              waHeaders["Authorization"] = `Bearer ${waConfig.ruangwa?.token}`;
            }

            const waPayload: any = {
              target: user.whatsapp,
              message: waMessageContent
            };

            if (waConfig.provider === "ruangwa") {
              waPayload.device_key = waConfig.ruangwa?.sender_number;
            }

            const waResponse = await fetch(waEndpoint, {
              method: "POST",
              headers: waHeaders,
              body: JSON.stringify(waPayload)
            });

            if (waResponse.ok) {
              followUpResults.whatsapp = { success: true, sent: true };
            } else {
              const waError = await waResponse.json();
              followUpResults.whatsapp = { success: false, reason: waError.message || "Failed to send" };
            }
          } else {
            followUpResults.whatsapp = { success: false, reason: "WhatsApp sender not active" };
          }
        } catch (waError: any) {
          console.error("Follow-up WhatsApp error:", waError);
          followUpResults.whatsapp = { success: false, reason: waError.message };
        }
      }

      // Log follow-up activity
      await query(
        `INSERT INTO audit_trails (user_id, aksi, deskripsi)
         VALUES ($1, $2, $3)`,
        [transaction.user_id, "FOLLOW_UP_SENT",
         `Follow-up dikirim untuk transaksi ${transactionId} via ${followUpChannel}: ${JSON.stringify(followUpResults)}`]
      );

      return NextResponse.json({
        success: true,
        message: "Follow-up berhasil dikirim",
        results: followUpResults
      });

    } else if (action === "expire") {
      // Mark transaction as expired
      if (transaction.status !== "PENDING") {
        return NextResponse.json({ error: "Hanya transaksi berstatus PENDING yang dapat dikenang kadaluarsa" }, { status: 400 });
      }

      await query(
        "UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2",
        ["EXPIRED", transactionId]
      );

      return NextResponse.json({ success: true, message: "Transaksi berhasil dikenang kadaluarsa" });

    } else if (action === "cancel") {
      // Cancel pending transaction
      if (transaction.status !== "PENDING") {
        return NextResponse.json({ error: "Hanya transaksi berstatus PENDING yang dapat dibatalkan" }, { status: 400 });
      }

      await query(
        "UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2",
        ["CANCELLED", transactionId]
      );

      return NextResponse.json({ success: true, message: "Transaksi berhasil dibatalkan" });

    } else if (action === "resend_invoice") {
      // Resend invoice to customer
      if (!["PENDING", "EXPIRED"].includes(transaction.status)) {
        return NextResponse.json({ error: "Hanya transaksi PENDING atau EXPIRED yang dapat dikirim ulang invoice" }, { status: 400 });
      }

      // Generate new invoice URL based on gateway config
      const pgConfigRes = await query(
        "SELECT value FROM system_settings WHERE key = 'payment_gateway'"
      );
      const pgConfig = pgConfigRes.rows[0]?.value || {};
      const gateway = pgConfig.default_gateway || "mock";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      let invoiceUrl = `${appUrl}/api/checkout/mock?invoice_id=${transaction.id}&amount=${transaction.amount}&userId=${transaction.user_id}&plan=${transaction.plan_id}`;

      if (gateway === "xendit" && pgConfig.xendit?.api_key) {
        const xenditApiKey = pgConfig.xendit.api_key;
        const authHeader = Buffer.from(xenditApiKey + ":").toString("base64");

        const xenditResponse = await fetch("https://api.xendit.co/v2/invoices", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            external_id: transaction.external_id,
            amount: Number(transaction.amount),
            payer_email: user.email,
            description: `GuruPRO Premium - ${transaction.plan_id}`,
            invoice_duration: 86400,
            success_redirect_url: `${appUrl}/dashboard?payment=success&tx=${transaction.id}`,
            failure_redirect_url: `${appUrl}/dashboard?payment=failed`,
          }),
        });

        if (xenditResponse.ok) {
          const invoice = await xenditResponse.json();
          invoiceUrl = invoice.invoice_url;
        }
      }

      // Send invoice via email
      try {
        const emailConfigRes = await query(
          "SELECT value FROM system_settings WHERE key = 'email_sender'"
        );
        const emailConfig = emailConfigRes.rows[0]?.value || {};

        if (emailConfig.active) {
          const nodemailer = await import("nodemailer");
          const transporter = nodemailer.default.createTransport({
            host: emailConfig.smtp?.host,
            port: emailConfig.smtp?.port || 587,
            secure: emailConfig.smtp?.secure,
            auth: {
              user: emailConfig.smtp?.user,
              pass: emailConfig.smtp?.pass
            }
          });

          const invoiceEmailBody = `
            <h2>Halo ${user.nama_lengkap},</h2>
            <p>Berikut adalah tautan invoice pembayaran untuk langganan GuruPRO Premium:</p>
            <p><a href="${invoiceUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Bayar Sekarang</a></p>
            <p>Invoice #: ${transaction.external_id}</p>
            <p>Jumlah: Rp ${Number(transaction.amount).toLocaleString("id-ID")}</p>
            <p>Link ini berlaku selama 24 jam.</p>
            <p>Terima kasih,<br>Tim GuruPRO</p>
          `;

          await transporter.sendMail({
            from: `"${emailConfig.sender_name || "GuruPRO"}" <${emailConfig.sender_email}>`,
            to: user.email,
            subject: `Invoice GuruPRO - ${transaction.external_id}`,
            html: invoiceEmailBody
          });

          // Update transaction status back to PENDING if expired
          if (transaction.status === "EXPIRED") {
            await query(
              "UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2",
              ["PENDING", transactionId]
            );
          }

          return NextResponse.json({
            success: true,
            message: "Invoice berhasil dikirim ulang ke email customer",
            invoiceUrl
          });
        }
      } catch (emailError: any) {
        console.error("Resend invoice email error:", emailError);
        return NextResponse.json({ error: "Gagal mengirim invoice via email" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Invoice berhasil dibuat ulang", invoiceUrl });

    } else {
      // Default: refund action
      if (transaction.status !== "ACTIVATED" && transaction.status !== "PAID") {
        return NextResponse.json({ error: "Hanya transaksi berstatus PAID atau ACTIVATED yang dapat direfund" }, { status: 400 });
      }

      const userId = transaction.user_id;
      const planKey = transaction.plan_id || "three_month";

      // Ambil detail paket dari CMS pricing_plans (single source of truth)
      const planRes = await query(
        `SELECT id, package_name, tokens, duration_days, price
         FROM pricing_plans
         WHERE (id = $1 OR LOWER(package_name) = LOWER($1::text)) AND is_active = true
         LIMIT 1`,
        [planKey]
      );

      let tokensToDeduct = 0;
      if (planRes.rows.length > 0) {
        tokensToDeduct = Number(planRes.rows[0].tokens || 0);
      } else {
        // Fallback by amount (masih dari pricing_plans)
        const amountPlan = await query(
          `SELECT tokens FROM pricing_plans WHERE is_active = true ORDER BY ABS(price - $1) ASC LIMIT 1`,
          [Number(transaction.amount)]
        );
        if (amountPlan.rows.length > 0) {
          tokensToDeduct = Number(amountPlan.rows[0].tokens || 0);
        }
      }

      // Ambil data user saat ini untuk audit trail
      const userBeforeRes = await query(
        "SELECT quota_poin_total, status_langganan, subscription_end FROM users WHERE id = $1",
        [userId]
      );

      // Update transaction status to REFUNDED
      await query("UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2", ["REFUNDED", transactionId]);

      // Deduct poin from user and downgrade subscription status to refunded if it was activated
      if (transaction.status === "ACTIVATED") {
        await query(
          `UPDATE users
           SET quota_poin_total = GREATEST(0, COALESCE(quota_poin_total, 0) - $1),
               status_langganan = 'free',
               subscription_status = 'refunded',
               subscription_end = NOW(),
               grace_period_ends_at = NULL,
               last_expiry_warning_sent = NULL
           WHERE id = $2`,
          [tokensToDeduct, userId]
        );
      }

      // Audit trail untuk refund
      const userAfterRes = await query(
        "SELECT quota_poin_total, status_langganan FROM users WHERE id = $1",
        [userId]
      );
      const userAfter = userAfterRes.rows[0];
      await query(
        `INSERT INTO audit_trails (user_id, aksi, deskripsi, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          "Refund Transaksi",
          `Refund transaksi ${transactionId} (${planKey}) - Potong ${tokensToDeduct} poin dari ${userAfter?.quota_poin_total || 0} → ${Math.max(0, (userAfter?.quota_poin_total || 0) - tokensToDeduct)}. Status: ${userAfter?.status_langganan || 'unknown'} → refunded. Admin: manual refund.`,
          "admin_panel"
        ]
      );

      // Kirim notifikasi refund ke user
      await sendEventNotification("refund", user, {
        refund_amount: Number(transaction.amount),
        refund_tokens: tokensToDeduct,
        plan_name: planKey,
        reason: "Refund oleh admin"
      }).catch(() => {}); // Non-blocking, jangan fail jika notifikasi gagal

      return NextResponse.json({ success: true, message: "Transaksi berhasil direfund." });
    }
  } catch (error: any) {
    console.error("Admin Transactions POST error:", error);
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}