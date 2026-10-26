"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore, useTeacherStore } from "@/lib/stores";

/**
 * SessionValidator
 *
 * Checks session revocation status via the server-side session store on mount
 * and on every route change. This complements the Edge-layer HMAC verification
 * in middleware.ts — the Edge layer is STATELESS (cannot query user_sessions DB),
 * so we add a lightweight DB check here for immediate revocation detection.
 *
 * If the session is revoked/expired in user_sessions, we clear all cached data
 * and the client should redirect to /login.
 *
 * Only validates if there's existing cached data — avoids unnecessary calls for
 * fresh sessions with no prior local state.
 */
export default function SessionValidator() {
  const router = useRouter();
  const clearProfile = useProfileStore(s => s.clearProfile);
  const resetContext = useTeacherStore(s => s.resetContext);
  const profile = useProfileStore(s => s.profile);
  const cachedUserId = useProfileStore(s => s.cachedUserId);
  const initialized = useRef(false);

  /**
   * Perform the revocation check. Reads sid from the gurupro_session cookie
   * and sends it to /api/auth/session-status for DB verification.
   */
  const checkSessionStatus = useCallback(async () => {
    // Only check if we have cached data that needs to be validated
    if (!profile && !cachedUserId) {
      return;
    }

    try {
      // Extract sid from the gurupro_session cookie
      const cookieString = document.cookie;
      const match = cookieString
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("gurupro_session="));

      if (!match) {
        // No session cookie at all — clear cached data
        console.log("[SessionValidator] No session cookie, clearing caches");
        triggerLogout();
        return;
      }

      const cookieValue = match.slice("gurupro_session=".length);
      let sid: string | undefined;
      let sessionId: string | undefined;

      try {
        const decoded = decodeURIComponent(cookieValue);
        const parsed = JSON.parse(decoded);
        sid = parsed?.sid;
        sessionId = parsed?.id;
      } catch {
        // Malformed cookie — clear caches
        triggerLogout();
        return;
      }

      if (!sid) {
        // No server-side session id in cookie (legacy session or OAuth-only).
        // Cannot check revocation — skip and let the normal validateSession handle it.
        console.log("[SessionValidator] No sid in cookie, skipping revocation check");
        return;
      }

      const res = await fetch("/api/auth/session-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sid, sessionId }),
      });

      if (!res.ok) {
        console.warn("[SessionValidator] session-status returned non-OK:", res.status);
        return;
      }

      const data = await res.json();
      if (!data.valid) {
        console.log(
          "[SessionValidator] Session revoked or expired:",
          data.reason ?? "no reason"
        );
        triggerLogout();
      }
    } catch (err) {
      // Network or parse errors — log and remain silent rather than clearing
      // valid sessions due to a transient error.
      console.error("[SessionValidator] session-status check error:", err);
    }
  }, [profile, cachedUserId]);

  function triggerLogout() {
    // Clear all localStorage that might contain stale user data
    if (typeof window !== "undefined") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes("profile") || key.includes("session") || key.includes("auth"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error(`Failed to remove ${key}:`, e);
        }
      });
      sessionStorage.clear();
    }

    // Clear stores
    clearProfile();
    resetContext();

    // Redirect to login
    const loginUrl = new URL("/login", window.location.origin);
    loginUrl.searchParams.set("redirect", window.location.pathname);
    window.location.href = loginUrl.toString();
  }

  useEffect(() => {
    // Skip on first render — wait for hydration
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    checkSessionStatus();
  }, [checkSessionStatus]);

  // Check on mount (after initial hydration)
  useEffect(() => {
    if (initialized.current) return; // already handled by the other effect
    initialized.current = true;
    checkSessionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
