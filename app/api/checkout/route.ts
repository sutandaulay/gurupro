import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPaymentGatewayConfig } from "@/lib/settings";
import { grantUserTokens } from "@/lib/token-system";
import { cookies } from "next/headers";

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function parsePrice(val: any): number {
  if (typeof val === "string") return parseFloat(val) || 0;
  return Number(val) || 0;
}

export async function POST(req: Request) {
  try {
    let { plan, userId, packageId } = await req.json();

    if (!userId) {
      // Fallback: try to resolve userId from active cookie session
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("gurupro_session")?.value;
      if (sessionCookie) {
        try {
          const session = JSON.parse(sessionCookie);
          userId = session.id;
        } catch (e) {
          console.error("Failed to parse session cookie in checkout API:", e);
        }
      }
    }

    if (!userId || !plan) {
      return NextResponse.json({ error: "Data user dan paket wajib diisi!" }, { status: 400 });
    }

    // 1. Get user data
    const userRes = await query("SELECT id, email, whatsapp, nama_lengkap FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan!" }, { status: 404 });
    }
    const user = userRes.rows[0];

    // 2. Determine plan details
    let amount = 0;
    let planLabel = "";
    let planKey = "";
    let durationDays = 0;
    let tokens = 0;
    let isFree = false;
    let isAddonPackage = false;

    if (plan === "addon") {
      isAddonPackage = true;
      const packageRes = await query("SELECT * FROM addon_token_packages WHERE id = $1 AND is_active = true", [packageId]);
      if (packageRes.rows.length === 0) {
        return NextResponse.json({ error: "Paket token tambahan tidak ditemukan atau tidak aktif!" }, { status: 404 });
      }
      const addonPackage = packageRes.rows[0];
      amount = parsePrice(addonPackage.price);
      planLabel = addonPackage.name;
      planKey = `addon:${addonPackage.id}`;
      durationDays = 0;
      tokens = Number(addonPackage.token_amount || 0);
      isFree = amount === 0;
    } else if (isUUID(plan)) {
      // New: Look up plan by UUID from pricing_plans table
      const planRes = await query("SELECT * FROM pricing_plans WHERE id = $1 AND is_active = true", [plan]);
      if (planRes.rows.length === 0) {
        return NextResponse.json({ error: "Paket tidak ditemukan atau tidak aktif!" }, { status: 404 });
      }
      const dbPlan = planRes.rows[0];
      amount = parsePrice(dbPlan.price);
      planLabel = dbPlan.package_name;
      planKey = dbPlan.id;
      durationDays = dbPlan.duration_days;
      tokens = typeof dbPlan.tokens === "string" ? parseInt(dbPlan.tokens) || 0 : dbPlan.tokens || 0;
      isFree = amount === 0;
    } else {
      // Legacy: Support old plan keys for backward compatibility
      const pricingConfigRes = await query("SELECT value FROM system_settings WHERE key = 'pricing_config'");
      let cfg: any = {};
      if (pricingConfigRes.rows.length > 0) {
        const raw = pricingConfigRes.rows[0].value;
        cfg = typeof raw === "string" ? JSON.parse(raw) : raw;
      }

      if (plan === "free") {
        isFree = true;
        const planCfg = isUUID(plan) ? null : (cfg.free || cfg[0]);
        if (planCfg) {
          amount = parsePrice(planCfg.price);
          planLabel = "GuruPRO Free";
          planKey = "free";
          durationDays = planCfg.duration_days || 30;
          tokens = planCfg.tokens || 10;
        } else {
          amount = 0;
          planLabel = "GuruPRO Free";
          planKey = "free";
          durationDays = 30;
          tokens = 10;
        }
      } else if (plan === "three_month" || plan === "pro_monthly") {
        const planCfg = cfg.three_month || cfg[1];
        amount = parsePrice(planCfg?.price || 120000);
        planLabel = "GuruPRO Premium 3 Bulan";
        planKey = "three_month";
        durationDays = planCfg?.duration_days || 90;
        tokens = planCfg?.tokens || 500;
      } else if (plan === "six_month") {
        const planCfg = cfg.six_month || cfg[2];
        amount = parsePrice(planCfg?.price || 220000);
        planLabel = "GuruPRO Premium 6 Bulan";
        planKey = "six_month";
        durationDays = planCfg?.duration_days || 180;
        tokens = planCfg?.tokens || 1100;
      } else if (plan === "one_year" || plan === "pro_yearly") {
        const planCfg = cfg.one_year || cfg[3];
        amount = parsePrice(planCfg?.price || 400000);
        planLabel = "GuruPRO Premium 1 Tahun";
        planKey = "one_year";
        durationDays = planCfg?.duration_days || 365;
        tokens = planCfg?.tokens || 2500;
      } else {
        return NextResponse.json({ error: "Paket tidak valid!" }, { status: 400 });
      }
    }

    if (isAddonPackage) {
      const transactionId = crypto.randomUUID();
      const externalId = `addon-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const pgConfig = await getPaymentGatewayConfig();
      const gateway = pgConfig.default_gateway || "mock";

      let checkoutUrl = "";
      let processedGateway = "MOCK";

      if (gateway === "xendit" && pgConfig.xendit.api_key) {
        try {
          const xenditApiKey = pgConfig.xendit.api_key;
          const authHeader = Buffer.from(xenditApiKey + ":").toString("base64");
          const xenditResponse = await fetch("https://api.xendit.co/v2/invoices", {
            method: "POST",
            headers: {
              "Authorization": `Basic ${authHeader}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              external_id: externalId,
              amount,
              payer_email: user.email,
              description: planLabel,
              invoice_duration: 86400,
              success_redirect_url: `${appUrl}/dashboard?payment=success&tx=${transactionId}`,
              failure_redirect_url: `${appUrl}/dashboard?payment=failed`,
            }),
          });

          if (!xenditResponse.ok) {
            const xenditErr = await xenditResponse.json();
            throw new Error(xenditErr.message || "Xendit returned error status");
          }
          const invoice = await xenditResponse.json();
          checkoutUrl = invoice.invoice_url;
          processedGateway = "XENDIT";
        } catch (err: any) {
          console.error("Xendit addon invoice failed, falling back to mock:", err.message);
        }
      }

      if (!checkoutUrl) {
        checkoutUrl = `/checkout/mock?invoice_id=${transactionId}&amount=${amount}&userId=${userId}&plan=${encodeURIComponent(planLabel)}`;
        processedGateway = "MOCK";
      }

      await query(
        `INSERT INTO transactions (id, user_id, external_id, amount, status, created_at, notes, plan_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
        [transactionId, userId, externalId, amount, "PENDING", `Top-up token tambahan via ${processedGateway}`, planKey]
      );

      return NextResponse.json({ checkoutUrl });
    }

    // Handle free plan
    if (isFree) {
      const transactionId = crypto.randomUUID();
      const userDateRes = await query("SELECT subscription_end, subscription_start FROM users WHERE id = $1", [userId]);
      let newEnd = new Date();
      const currentEnd = userDateRes.rows[0]?.subscription_end;
      const currentStart = userDateRes.rows[0]?.subscription_start;

      if (currentEnd && new Date(currentEnd) > new Date()) {
        newEnd = new Date(currentEnd);
      }
      newEnd.setDate(newEnd.getDate() + durationDays);

      await query(
        `UPDATE users 
         SET status_langganan = $1,
             subscription_start = COALESCE($2, NOW()),
             subscription_end = $3
         WHERE id = $4`,
        ["free", currentStart, newEnd, userId]
      );

      await grantUserTokens(userId, tokens);

      await query(
        `INSERT INTO transactions (id, user_id, external_id, amount, status, created_at, notes, plan_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
        [transactionId, userId, `free-${Date.now()}`, 0, "ACTIVATED", "Aktivasi Paket Free (Gratis)", planKey]
      );

      return NextResponse.json({ checkoutUrl: `/dashboard?payment=success&tx=${transactionId}` });
    }

    const transactionId = crypto.randomUUID();
    const externalId = `invoice-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const pgConfig = await getPaymentGatewayConfig();
    const gateway = pgConfig.default_gateway || "mock";

    let checkoutUrl = "";
    let processedGateway = "MOCK";

    if (gateway === "xendit" && pgConfig.xendit.api_key) {
      try {
        const xenditApiKey = pgConfig.xendit.api_key;
        const authHeader = Buffer.from(xenditApiKey + ":").toString("base64");

        const xenditResponse = await fetch("https://api.xendit.co/v2/invoices", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            external_id: externalId,
            amount: amount,
            payer_email: user.email,
            description: planLabel,
            invoice_duration: 86400,
            success_redirect_url: `${appUrl}/dashboard?payment=success&tx=${transactionId}`,
            failure_redirect_url: `${appUrl}/dashboard?payment=failed`,
          }),
        });

        if (!xenditResponse.ok) {
          const xenditErr = await xenditResponse.json();
          throw new Error(xenditErr.message || "Xendit returned error status");
        }

        const invoice = await xenditResponse.json();
        checkoutUrl = invoice.invoice_url;
        processedGateway = "XENDIT";
      } catch (err: any) {
        console.error("Xendit Invoice Generation failed, falling back to mock:", err.message);
      }
    }
    else if (gateway === "midtrans" && pgConfig.midtrans.server_key) {
      try {
        const { server_key, is_sandbox } = pgConfig.midtrans;
        const authHeader = Buffer.from(server_key + ":").toString("base64");
        const midtransUrl = is_sandbox
          ? "https://app.sandbox.midtrans.com/snap/v1/transactions"
          : "https://app.midtrans.com/snap/v1/transactions";

        const midtransResponse = await fetch(midtransUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            transaction_details: {
              order_id: externalId,
              gross_amount: amount
            },
            credit_card: {
              secure: true
            },
            customer_details: {
              first_name: user.nama_lengkap,
              email: user.email,
              phone: user.whatsapp
            },
            item_details: [{
              id: plan,
              price: amount,
              quantity: 1,
              name: planLabel
            }],
            callbacks: {
              finish: `${appUrl}/dashboard?payment=success&tx=${transactionId}`,
              error: `${appUrl}/dashboard?payment=failed`,
              close: `${appUrl}/dashboard`
            }
          })
        });

        if (!midtransResponse.ok) {
          const midtransErr = await midtransResponse.json().catch(() => ({}));
          throw new Error(midtransErr.error_messages?.[0] || "Midtrans returned error status");
        }

        const snapData = await midtransResponse.json();
        checkoutUrl = snapData.redirect_url;
        processedGateway = "MIDTRANS";
      } catch (err: any) {
        console.error("Midtrans Snap Generation failed, falling back to mock:", err.message);
      }
    }
    else if (gateway === "duitku" && pgConfig.duitku.merchant_code && pgConfig.duitku.api_key) {
      try {
        const { merchant_code, api_key, is_sandbox } = pgConfig.duitku;
        const duitkuUrl = is_sandbox
          ? "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry"
          : "https://passport.duitku.com/webapi/api/merchant/v2/inquiry";

        const orderId = externalId;
        const signature = crypto.createHash("md5")
          .update(merchant_code + orderId + amount + api_key)
          .digest("hex");

        const duitkuResponse = await fetch(duitkuUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            merchantCode: merchant_code,
            paymentAmount: amount,
            merchantOrderId: orderId,
            productDetails: planLabel,
            email: user.email,
            phoneNumber: user.whatsapp,
            customerVaName: user.nama_lengkap,
            callbackUrl: `${appUrl}/api/webhook/duitku`,
            returnUrl: `${appUrl}/dashboard?payment=success&tx=${transactionId}`,
            signature: signature,
            expiryPeriod: 1440
          })
        });

        if (!duitkuResponse.ok) {
          const duitkuErr = await duitkuResponse.json().catch(() => ({}));
          throw new Error(duitkuErr.message || "Duitku returned error status");
        }

        const duitkuData = await duitkuResponse.json();

        if (duitkuData.paymentUrl) {
          checkoutUrl = duitkuData.paymentUrl;
          processedGateway = "DUITKU";
        } else {
          throw new Error(duitkuData.message || "Duitku returned no paymentUrl");
        }
      } catch (err: any) {
        console.error("Duitku Inquiry failed, falling back to mock:", err.message);
      }
    }

    if (!checkoutUrl) {
      checkoutUrl = `/checkout/mock?invoice_id=${transactionId}&amount=${amount}&userId=${userId}&plan=${plan}`;
      processedGateway = "MOCK";
    }

    await query(
      `INSERT INTO transactions (id, user_id, external_id, amount, status, created_at, notes, plan_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [transactionId, userId, externalId, amount, "PENDING", `Processed via ${processedGateway}`, planKey]
    );

    return NextResponse.json({ checkoutUrl });
  } catch (error: any) {
    console.error("Checkout API error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses checkout" }, { status: 500 });
  }
}