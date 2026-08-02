"use client";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useProfileStore } from "@/lib/stores";

export default function SessionSync() {
  const { status } = useSession();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (status !== "authenticated") return;

    initialized.current = true;

    // Step 1: Sync session cookie (must complete first)
    fetch("/api/auth/sync-session", {
      method: "POST",
      credentials: "include",
    })
      .then(() => {
        // Step 2: After cookie is set, fetch profile in parallel with role flags
        Promise.allSettled([
          useProfileStore.getState().fetchProfile(),
          // Role flags for sidebar
          fetch("/api/user/role-flags", { credentials: "include" }),
        ]).then(([profileResult, roleResult]) => {
          if (profileResult.status === "rejected") {
            console.error("[SessionSync] Profile fetch failed:", profileResult.reason);
          }
        });
      })
      .catch((err) => {
        console.error("[SessionSync] sync-session failed:", err);
        // Still try to fetch profile even if sync fails (profile API has its own auth)
        useProfileStore.getState().fetchProfile().catch((e) => {
          console.error("[SessionSync] Profile fetch also failed:", e);
        });
      });

    // 3. Process referral code if exists (non-blocking, independent)
    const refCode = localStorage.getItem("referral_code");
    if (refCode) {
      localStorage.removeItem("referral_code");
      fetch("/api/auth/referral/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ referral_code: refCode }),
      }).catch(() => {});
    }
  }, [status]);

  return null;
}
