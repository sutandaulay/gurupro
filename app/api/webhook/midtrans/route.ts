/**
 * Midtrans Webhook Handler
 *
 * Verifies the Midtrans SHA512 signature and delegates to the shared
 * webhook processor in @/lib/webhook-utils.
 *
 * NOTE: This endpoint is a legacy path. The canonical endpoint is
 * /api/webhook/payment which auto-detects the gateway. Prefer calling
 * /api/webhook/payment directly.
 *
 * Signature verification:
 *   - Computes SHA512(order_id + status_code + gross_amount + server_key)
 *   - Compares against signature_key from payload or x-server-key header
 *   - Server key source: MIDTRANS_SERVER_KEY env -> system_settings
 *   - Also accepts direct x-server-key header match (no signature_key in payload)
 */

import { NextResponse } from "next/server";
import { verifyMidtransSignature, handleMidtransCallback } from "@/lib/webhook-utils";
import { corsHeaders, handleCorsPreflight } from "@/lib/cors";

export async function POST(req: Request) {
  // --- CORS preflight ---
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");

  try {
    const payload = await req.json().catch(() => ({}));
    console.log("[MidtransWebhook] Received payload:", JSON.stringify(payload));

    // --- Signature verification ---
    const sigError = await verifyMidtransSignature(req, payload);
    if (sigError) {
      const headers = { ...sigError.headers, ...corsHeaders(origin) };
      return new NextResponse(sigError.body, { status: sigError.status, headers });
    }

    // --- Delegate to shared handler ---
    const response = await handleMidtransCallback(req);
    const headers = { ...response.headers, ...corsHeaders(origin) };
    return new NextResponse(response.body, { status: response.status, headers });
  } catch (err: any) {
    console.error("[MidtransWebhook] Unexpected error:", err);
    const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };
    return new NextResponse(JSON.stringify({ error: err.message || "webhook error" }), { status: 500, headers });
  }
}
