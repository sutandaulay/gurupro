"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export default function SessionSync() {
  const { data: session, status } = useSession();
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    if (status !== "authenticated") return;

    // Try to sync gurupro_session cookie for Google login users.
    // This is best-effort — API routes now also check NextAuth
    // session as fallback, so this isn't strictly required.
    fetch("/api/auth/sync-session", { method: "POST" })
      .then((res) => {
        if (res.ok) {
          synced.current = true;
        }
      })
      .catch(() => {});
  }, [status]);

  return null;
}
