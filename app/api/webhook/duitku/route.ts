import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPaymentGatewayConfig } from "@/lib/settings";
import { processSuccessPayment } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    let body: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    } else {
      body = await req.json();
    }

    console.log("[DUITKU WEBHOOK RECEIVED]:", body);

    const {
      merchantCode,
      amount,
      merchantOrderId,
      paymentCode,
      resultCode,
      signature
    } = body;

    if (!merchantCode || !amount || !merchantOrderId || !resultCode || !signature) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    // 1. Get Duitku config to verify signature
    const pgConfig = await getPaymentGatewayConfig();
    const apiKey = pgConfig.duitku.api_key;

    if (apiKey) {
      // Signature formula: MD5(merchantCode + amount + merchantOrderId + apiKey)
      const payloadString = merchantCode + amount + merchantOrderId + apiKey;
      const calculatedSignature = crypto
        .createHash("md5")
        .update(payloadString)
        .digest("hex");

      if (calculatedSignature.toLowerCase() !== signature.toLowerCase()) {
        console.warn("[DUITKU WEBHOOK] Signature mismatch. Calculated:", calculatedSignature, "Received:", signature);
        return NextResponse.json({ error: "Signature key mismatch" }, { status: 403 });
      }
    }

    // 2. Check if payment was successful (resultCode "00")
    if (resultCode === "00") {
      const result = await processSuccessPayment(merchantOrderId, `DUITKU-${paymentCode.toUpperCase()}`, Number(amount));
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      
      // Duitku expects a plain response of "OK" or similar. We can return it directly or with headers.
      return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    return new NextResponse("NOT_OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (error: any) {
    console.error("Duitku webhook error:", error);
    return NextResponse.json({ error: error.message || "Webhook processing error" }, { status: 500 });
  }
}
