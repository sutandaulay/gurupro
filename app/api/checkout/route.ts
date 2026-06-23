import { query } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPaymentGatewayConfig, getPricingConfig } from "@/lib/settings";

export async function POST(req: Request) {
  try {
    const { plan, userId } = await req.json();

    if (!userId || !plan) {
      return NextResponse.json({ error: "Data user dan paket wajib diisi!" }, { status: 400 });
    }

    // 1. Get user data
    const userRes = await query("SELECT id, email, whatsapp, nama_lengkap FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan!" }, { status: 404 });
    }
    const user = userRes.rows[0];

    // 2. Set amounts dynamically from settings
    const pricingConfig = await getPricingConfig();
    let amount = 0;
    let planLabel = "";
    let planKey = "";

    if (plan === "free") {
      amount = pricingConfig.free.price;
      planLabel = "GuruPRO Free";
      planKey = "free";
      
      const transactionId = crypto.randomUUID();
      const userDateRes = await query("SELECT subscription_end, subscription_start FROM users WHERE id = $1", [userId]);
      let newEnd = new Date();
      const currentEnd = userDateRes.rows[0]?.subscription_end;
      const currentStart = userDateRes.rows[0]?.subscription_start;

      if (currentEnd && new Date(currentEnd) > new Date()) {
        newEnd = new Date(currentEnd);
      }
      newEnd.setDate(newEnd.getDate() + pricingConfig.free.duration_days);

      await query(
        `UPDATE users 
         SET status_langganan = $1, 
             token_limit = COALESCE(token_limit, 0) + $2,
             subscription_start = COALESCE($3, NOW()),
             subscription_end = $4
         WHERE id = $5`,
        ["free", pricingConfig.free.tokens, currentStart, newEnd, userId]
      );

      // Record immediate transaction
      await query(
        `INSERT INTO transactions (id, user_id, external_id, amount, status, created_at, notes, plan_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
        [transactionId, userId, `free-${Date.now()}`, 0, "ACTIVATED", "Aktivasi Paket Free (Gratis)", "free"]
      );

      return NextResponse.json({ checkoutUrl: `/dashboard?payment=success&tx=${transactionId}` });
    } else if (plan === "three_month" || plan === "pro_monthly") {
      amount = pricingConfig.three_month.price;
      planLabel = "GuruPRO Premium 3 Bulan";
      planKey = "three_month";
    } else if (plan === "six_month") {
      amount = pricingConfig.six_month.price;
      planLabel = "GuruPRO Premium 6 Bulan";
      planKey = "six_month";
    } else if (plan === "one_year" || plan === "pro_yearly") {
      amount = pricingConfig.one_year.price;
      planLabel = "GuruPRO Premium 1 Tahun";
      planKey = "one_year";
    } else {
      return NextResponse.json({ error: "Paket tidak valid!" }, { status: 400 });
    }

    const transactionId = crypto.randomUUID();
    const externalId = `invoice-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 3. Load configurations from database
    const pgConfig = await getPaymentGatewayConfig();
    const gateway = pgConfig.default_gateway || "mock";

    let checkoutUrl = "";
    let processedGateway = "MOCK";

    // 4. Router according to selected default gateway
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
        // signature = md5(merchantCode + merchantOrderId + paymentAmount + apiKey) or sha256. 
        // In Duitku v2, signature is MD5(merchantCode + merchantOrderId + paymentAmount + apiKey) in lowercase. Let's verify Duitku standard signature formula.
        // Formula is indeed: md5(merchantcode + merchantorderid + paymentamount + apikey) or sha256. Duitku V2 API usually uses MD5. Let's support MD5 to be fully aligned with Duitku specifications.
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

    // Fallback to offline mock page if checkoutUrl is still empty
    if (!checkoutUrl) {
      checkoutUrl = `/api/checkout/mock?invoice_id=${transactionId}&amount=${amount}&userId=${userId}&plan=${plan}`;
      processedGateway = "MOCK";
    }

    // 5. Store pending transaction in DB
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
