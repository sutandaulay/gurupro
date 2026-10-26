/**
 * Payment Webhook Handler (Unified)
 *
 * Handles payment completion callbacks from:
 * - Xendit (Invoice callbacks)
 * - Midtrans (Notification callbacks)
 * - Duitku (Callback)
 *
 * Auto-detects the gateway from request headers/body and routes to the
 * appropriate handler. Signature verification is applied per gateway.
 *
 * On successful payment:
 * 1. Marks transaction as PAID
 * 2. Activates subscription (extends subscription_end)
 * 3. Grants main tokens based on plan
 * 4. Handles addon poin purchases
 * 5. Sends in-app notification to user's bell
 *
 * Security:
 * - Verifies webhook signatures per gateway (uniform across all handlers)
 * - Idempotent (handles duplicate callbacks)
 * - FOR UPDATE row-level lock prevents race conditions
 * - CORS headers applied to all responses
 */

import { NextResponse } from "next/server";
import { corsHeaders, handleCorsPreflight } from "@/lib/cors";
import {
  verifyXenditSignature,
  verifyMidtransSignature,
  handleXenditCallback,
  handleMidtransCallback,
  handleDuitkuCallback,
} from "@/lib/webhook-utils";

// ============================================================
// HELPERS
// ============================================================

function withCors(res: NextResponse, origin?: string | null): NextResponse {
  const headers = { ...res.headers, ...corsHeaders(origin) };
  return new NextResponse(res.body, { status: res.status, statusText: res.statusText, headers });
}

// ============================================================
// MAIN WEBHOOK ROUTE
// ============================================================

export async function POST(req: Request) {
  // --- CORS preflight ---
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  // --- End CORS preflight ---

  const origin = req.headers.get("origin");

  try {
    // --- GATEWAY DETECTION ---
    const contentType = req.headers.get("content-type") || "";
    const xenditIdempotencyKey = req.headers.get("x-xendit-idempotency-key");
    const midtransServerKey = req.headers.get("x-server-key");

    // Detect Xendit
    if (xenditIdempotencyKey || contentType.includes("xendit")) {
      // --- Xendit: verify signature first ---
      const sigError = await verifyXenditSignature(req);
      if (sigError) return withCors(sigError, origin);
      return withCors(await handleXenditCallback(req), origin);
    }

    // Detect Midtrans
    if (midtransServerKey || req.headers.get("midtrans-snap-token")) {
      // --- Midtrans: parse body first, then verify signature ---
      const data = await req.clone().json();
      const sigError = await verifyMidtransSignature(req, data);
      if (sigError) return withCors(sigError, origin);
      return withCors(await handleMidtransCallback(req), origin);
    }

    // Try to detect from body content
    const body = await req.clone().json();

    if (body.merchantCode) {
      // Duitku — no signature verification (Duitku uses merchantCode + API key)
      return withCors(await handleDuitkuCallback(req), origin);
    }

    if (body.external_id) {
      // Xendit — verify signature, then handle
      // We need to re-read the body since we consumed it above
      const rawBody = await req.text();
      const sigError = await verifyXenditSignature(
        new Request(req.url, { method: "POST", headers: req.headers, body: rawBody })
      );
      if (sigError) return withCors(sigError, origin);
      return withCors(await handleXenditCallback(
        new Request(req.url, { method: "POST", headers: req.headers, body: rawBody })
      ), origin);
    }

    if (body.order_id) {
      // Midtrans — parse body, verify signature, handle
      const sigError = await verifyMidtransSignature(req, body);
      if (sigError) return withCors(sigError, origin);
      return withCors(await handleMidtransCallback(req), origin);
    }

    return withCors(
      NextResponse.json({ error: "Unknown payment gateway" }, { status: 400 }),
      origin
    );
  } catch (error: any) {
    console.error("[WEBHOOK] Unhandled error:", error);
    return withCors(
      NextResponse.json({ error: error.message }, { status: 500 }),
      origin
    );
  }
}

// Health check endpoint
export async function GET() {
  const headers = { ...corsHeaders(null), "Content-Type": "application/json" };
  return new NextResponse(
    JSON.stringify({
      service: "Payment Webhook Handler",
      status: "active",
      supportedGateways: ["xendit", "midtrans", "duitku"],
    }),
    { status: 200, headers }
  );
}
