import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPaymentGatewayConfig } from "@/lib/settings";
import { processSuccessPayment } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[MIDTRANS WEBHOOK RECEIVED]:", body);

    const {
      order_id,
      status_code,
      gross_amount,
      transaction_status,
      payment_type,
      signature_key
    } = body;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    // 1. Get Midtrans Server Key from settings to verify signature key
    const pgConfig = await getPaymentGatewayConfig();
    const serverKey = pgConfig.midtrans.server_key;

    // Verify signature key if server key is configured
    if (serverKey) {
      const payloadString = order_id + status_code + gross_amount + serverKey;
      const calculatedSignature = crypto
        .createHash("sha512")
        .update(payloadString)
        .digest("hex");

      if (calculatedSignature !== signature_key) {
        console.warn("[MIDTRANS WEBHOOK] Signature mismatch. Calculated:", calculatedSignature, "Received:", signature_key);
        return NextResponse.json({ error: "Signature key mismatch" }, { status: 403 });
      }
    }

    // 2. Check if transaction is paid
    const isPaid = 
      transaction_status === "settlement" || 
      (transaction_status === "capture" && body.fraud_status === "accept");

    if (isPaid) {
      const result = await processSuccessPayment(order_id, `MIDTRANS-${payment_type.toUpperCase()}`, Number(gross_amount));
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "Webhook processed, payment completed." });
    }

    return NextResponse.json({ success: true, message: `Status is ${transaction_status}. No action taken.` });
  } catch (error: any) {
    console.error("Midtrans webhook error:", error);
    return NextResponse.json({ error: error.message || "Webhook processing error" }, { status: 500 });
  }
}
