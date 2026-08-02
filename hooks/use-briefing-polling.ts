"use client";

import { useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL_MS = 30_000;

export function useBriefingPolling(enabled: boolean, onNotify: (data: { message: string; scheduleId: string | null }) => void) {
  const notifiedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/notifications/upcoming-briefing", {
        method: "GET",
        headers: { "Cache-Control": "no-store" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        shouldNotify: boolean;
        message: string;
        scheduleId: string | null;
      };

      if (data.shouldNotify && data.scheduleId && !notifiedRef.current.has(data.scheduleId)) {
        notifiedRef.current.add(data.scheduleId);
        onNotify({ message: data.message, scheduleId: data.scheduleId });
      }
    } catch {
      // silent
    }
  }, [enabled, onNotify]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    tick();

    timerRef.current = setInterval(tick, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onFocus = () => {
      tick();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, tick]);
}
