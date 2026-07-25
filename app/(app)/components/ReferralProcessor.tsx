"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect } from "react";
import { REFERRAL_STORAGE_KEY } from "@/lib/oauth";

/**
 * After a Google OAuth login, the referral code is stored in localStorage by the
 * shared signInWithGoogle helper. This component processes it once the user has
 * a session, using the existing /api/auth/referral/process endpoint, then clears it.
 */
export default function ReferralProcessor() {
  useEffect(() => {
    const code = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!code) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/auth/referral/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode: code }),
        });
        if (!cancelled && res.ok) {
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
        }
      } catch {
        /* keep the code for a later retry */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
