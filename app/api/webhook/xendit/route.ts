import { NextResponse } from "next/server";
import { processSuccessPayment } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[XENDIT WEBHOOK RECEIVED]:", body);

    const status = body.status;
    const isMock = body.isMock || false;
    const paymentMethod = body.payment_method || "UNKNOWN";

    if (status !== "PAID") {
      return NextResponse.json({ message: "Invoice status is not PAID. No action taken." });
    }

    // Call shared processSuccessPayment function
    const externalId = isMock ? body.id : body.external_id;
    const result = await processSuccessPayment(externalId, `XENDIT-${paymentMethod.toUpperCase()}`, Number(body.amount || 0), isMock);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Webhook processed, tokens added." });
  } catch (error: any) {
    console.error("Xendit webhook processing error:", error);
    return NextResponse.json({ error: error.message || "Webhook processing error" }, { status: 500 });
  }
}
