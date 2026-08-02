import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPaymentGatewayConfig } from "@/lib/settings";
import { grantUserPoin } from "@/src/services/poin-service";
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
    const userRes = await query("SELECT id, email, whatsapp, nama_lengkap, status_langganan, subscription_end FROM users WHERE id = $1", [userId]);
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
      tokens = Number(addonPackage.poin_amount || 0);
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
      // Legacy: dukung plan key lama, tapi TETAP ambil dari CMS pricing_plans by package_name
      const legacyNameMap: Record<string, string> = {
        free: "Gratis",
        three_month: "3 Bulan",
        pro_monthly: "3 Bulan",
        six_month: "6 Bulan",
        one_year: "1 Tahun",
        pro_yearly: "1 Tahun",
      };
      const lookupName = legacyNameMap[plan];
      if (!lookupName) {
        return NextResponse.json({ error: "Paket tidak valid!" }, { status: 400 });
      }
      const planRes = await query(
        "SELECT * FROM pricing_plans WHERE LOWER(package_name) = LOWER($1) AND is_active = true LIMIT 1",
        [lookupName]
      );
      if (planRes.rows.length === 0) {
        return NextResponse.json({ error: "Paket tidak ditemukan di CMS pricing_plans!" }, { status: 400 });
      }
      const dbPlan = planRes.rows[0];
      amount = parsePrice(dbPlan.price);
      planLabel = dbPlan.package_name;
      planKey = dbPlan.id;
      durationDays = dbPlan.duration_days;
      tokens = Number(dbPlan.tokens || 0);
      if (lookupName === "Gratis") isFree = amount === 0;
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
          const xenditBaseUrl = pgConfig.xendit.is_sandbox
            ? "https://api.xendit.co/v2/invoices"
            : "https://api.xendit.co/v2/invoices";
          const xenditResponse = await fetch(xenditBaseUrl, {
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
              callback_url: `${appUrl}/api/webhook/xendit`,
            }),
          });

          if (!xenditResponse.ok) {
            const xenditErr = await xenditResponse.json().catch(() => ({}));
            throw new Error(xenditErr.message || `Xendit error (${xenditResponse.status})`);
          }
          const invoice = await xenditResponse.json();
          checkoutUrl = invoice.invoice_url;
          processedGateway = `XENDIT${pgConfig.xendit.is_sandbox ? "_SANDBOX" : ""}`;
        } catch (err: any) {
          console.error("Xendit addon invoice failed:", err.message);
          return NextResponse.json({ error: `Pembayaran Xendit gagal: ${err.message}` }, { status: 502 });
        }
      } else if (gateway === "xendit") {
        return NextResponse.json({ error: "Konfigurasi Xendit tidak lengkap (api_key kosong)." }, { status: 500 });
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
      // Cek apakah user sudah pernah mendapat free plan (via registrasi atau checkout sebelumnya)
      const [uRes, txRes] = await Promise.all([
        query("SELECT status_langganan, subscription_start FROM users WHERE id = $1", [userId]),
        query("SELECT id FROM transactions WHERE user_id = $1 AND amount = 0 AND status = 'ACTIVATED' LIMIT 1", [userId]),
      ]);
      const userRow = uRes.rows[0];
      if (
        userRow?.status_langganan === "free" ||
        userRow?.subscription_start != null ||
        txRes.rows.length > 0
      ) {
        return NextResponse.json({ error: "Kamu sudah pernah menggunakan paket Free. Tidak bisa mengaktifkan ulang." }, { status: 400 });
      }
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
             subscription_status = 'active',
             subscription_start = COALESCE($2, NOW()),
             subscription_end = $3
         WHERE id = $4`,
        ["free", currentStart, newEnd, userId]
      );

      await grantUserPoin(userId, tokens);

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
              callback_url: `${appUrl}/api/webhook/xendit`,
            }),
        });

        if (!xenditResponse.ok) {
          const xenditErr = await xenditResponse.json().catch(() => ({}));
          throw new Error(xenditErr.message || `Xendit error (${xenditResponse.status})`);
        }

        const invoice = await xenditResponse.json();
        checkoutUrl = invoice.invoice_url;
        processedGateway = `XENDIT${pgConfig.xendit.is_sandbox ? "_SANDBOX" : ""}`;
      } catch (err: any) {
        console.error("Xendit Invoice Generation failed:", err.message);
        return NextResponse.json({ error: `Pembayaran Xendit gagal: ${err.message}` }, { status: 502 });
      }
    }
    else if (gateway === "xendit") {
      return NextResponse.json({ error: "Konfigurasi Xendit tidak lengkap (api_key kosong)." }, { status: 500 });
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
          throw new Error(midtransErr.error_messages?.[0] || `Midtrans error (${midtransResponse.status})`);
        }

        const snapData = await midtransResponse.json();
        checkoutUrl = snapData.redirect_url;
        processedGateway = `MIDTRANS${is_sandbox ? "_SANDBOX" : ""}`;
      } catch (err: any) {
        console.error("Midtrans Snap Generation failed:", err.message);
        return NextResponse.json({ error: `Pembayaran Midtrans gagal: ${err.message}` }, { status: 502 });
      }
    }
    else if (gateway === "midtrans") {
      return NextResponse.json({ error: "Konfigurasi Midtrans tidak lengkap (server_key kosong)." }, { status: 500 });
    }
    else if (gateway === "duitku" && pgConfig.duitku.merchant_code && pgConfig.duitku.api_key) {
      const { merchant_code, api_key, is_sandbox } = pgConfig.duitku;
      try {
        const duitkuUrl = is_sandbox
          ? "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry"
          : "https://passport.duitku.com/webapi/api/merchant/v2/inquiry";

        const orderId = externalId;
        const signature = crypto.createHash("sha256")
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
            paymentMethod: "SP",
            merchantOrderId: orderId,
            productDetails: planLabel,
            email: user.email,
            phoneNumber: user.whatsapp,
            customerVaName: user.nama_lengkap,
            itemDetails: [
              {
                name: planLabel,
                price: amount,
                quantity: 1,
              },
            ],
            customerDetail: {
              firstName: user.nama_lengkap?.split(" ")[0] || "Customer",
              lastName: user.nama_lengkap?.split(" ").slice(1).join(" ") || "",
              email: user.email,
              phoneNumber: user.whatsapp || "",
              billingAddress: {
                firstName: user.nama_lengkap?.split(" ")[0] || "Customer",
                lastName: user.nama_lengkap?.split(" ").slice(1).join(" ") || "",
                address: "",
                city: "",
                postalCode: "",
                phone: user.whatsapp || "",
                countryCode: "ID",
              },
              shippingAddress: {
                firstName: user.nama_lengkap?.split(" ")[0] || "Customer",
                lastName: user.nama_lengkap?.split(" ").slice(1).join(" ") || "",
                address: "",
                city: "",
                postalCode: "",
                phone: user.whatsapp || "",
                countryCode: "ID",
              },
            },
            callbackUrl: `${appUrl}/api/webhook/duitku`,
            returnUrl: `${appUrl}/dashboard?payment=success&tx=${transactionId}`,
            signature: signature,
            expiryPeriod: 1440
          })
        });

        if (!duitkuResponse.ok) {
          const duitkuErr = await duitkuResponse.json().catch(() => ({}));
          throw new Error(duitkuErr.message || `Duitku error (${duitkuResponse.status})`);
        }

        const duitkuData = await duitkuResponse.json();

        if (duitkuData.paymentUrl) {
          checkoutUrl = duitkuData.paymentUrl;
          processedGateway = `DUITKU${is_sandbox ? "_SANDBOX" : ""}`;
        } else {
          throw new Error(duitkuData.message || "Duitku returned no paymentUrl");
        }
      } catch (err: any) {
        console.error("Duitku Inquiry failed:", err.message);
        if (is_sandbox) {
          checkoutUrl = `/checkout/mock?invoice_id=${transactionId}&amount=${amount}&userId=${userId}&plan=${plan}`;
          processedGateway = "MOCK";
        } else {
          return NextResponse.json({ error: `Pembayaran Duitku gagal: ${err.message}` }, { status: 502 });
        }
      }
    }
    else if (gateway === "duitku") {
      return NextResponse.json({ error: "Konfigurasi Duitku tidak lengkap (merchant_code/api_key kosong)." }, { status: 500 });
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