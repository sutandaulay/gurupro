"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useProfileStore, useTeacherStore } from "@/lib/stores";

export default function SessionSync() {
  const { data: session, status } = useSession();
  const synced = useRef(false);
  const cachedUserId = useProfileStore(s => s.cachedUserId);

  useEffect(() => {
    if (synced.current) return;
    if (status !== "authenticated") return;

    async function syncAndProcess() {
      try {
        // 1. Sync NextAuth session → gurupro_session cookie
        const syncRes = await apiFetch("/api/auth/sync-session", { method: "POST" });
        if (!syncRes.ok) {
          console.error("[SessionSync] Failed to sync session");
          return;
        }
        synced.current = true;

        // 2. Check if session changed - if so, refresh profile
        if (cachedUserId) {
          try {
            const sessionDataRes = await apiFetch("/api/auth/active-context", {
              credentials: 'include'
            });

            if (sessionDataRes.ok) {
              const sessionData = await sessionDataRes.json();
              const currentUserId = sessionData.userId;

              // If user ID changed, clear cached data
              if (currentUserId && cachedUserId && String(currentUserId) !== String(cachedUserId)) {
                console.log('[SessionSync] Session changed - clearing caches');
                useProfileStore.getState().clearProfile();
                useTeacherStore.getState().resetContext();
              }
            }
          } catch {
            // Non-critical, ignore
          }
        }

        // 3. Process referral code from localStorage (for Google OAuth users).
        const refCode = localStorage.getItem("referral_code");
        if (refCode) {
          try {
            await apiFetch("/api/auth/referral/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ referral_code: refCode }),
            });
          } catch {
            // Non-critical
          }
          localStorage.removeItem("referral_code");
        }
      } catch (err) {
        console.error("[SessionSync] Error:", err);
      }
    }

    syncAndProcess();
  }, [status, cachedUserId]);

  return null;
}


