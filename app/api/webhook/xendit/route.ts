/**
 * Xendit Webhook Handler
 *
 * Verifies the Xendit callback token and delegates to the shared
 * webhook processor in @/lib/webhook-utils.
 *
 * NOTE: This endpoint is a legacy path. The canonical endpoint is
 * /api/webhook/payment which auto-detects the gateway. Prefer calling
 * /api/webhook/payment directly.
 *
 * Signature verification:
 *   Priority: XENDIT_WEBHOOK_TOKEN env var -> system_settings payment_gateway.xendit.verification_token
 *   Uses timing-safe comparison to prevent timing attacks.
 */

import { NextResponse } from "next/server";
import { verifyXenditSignature, handleXenditCallback } from "@/lib/webhook-utils";
import { corsHeaders, handleCorsPreflight } from "@/lib/cors";

export async function POST(req: Request) {
  // --- CORS preflight ---
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");

  // --- Signature verification ---
  const sigError = await verifyXenditSignature(req);
  if (sigError) {
    const headers = { ...sigError.headers, ...corsHeaders(origin) };
    return new NextResponse(sigError.body, { status: sigError.status, headers });
  }

  // --- Delegate to shared handler ---
  const response = await handleXenditCallback(req);
  const headers = { ...response.headers, ...corsHeaders(origin) };
  return new NextResponse(response.body, { status: response.status, headers });
}
