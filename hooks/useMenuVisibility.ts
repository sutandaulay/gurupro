"use client";

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api-client";

/**
 * Ambil daftar feature key yang tersembunyi untuk user
 * (berdasarkan role & institusi aktif). Default: semua tampil.
 */
export function useMenuVisibility() {
  const [hiddenKeys, setHiddenKeys] = useState<string[] | null>(null);
  const [institutionId, setInstitutionId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch("/api/user/menu-visibility");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setHiddenKeys(Array.isArray(data.hiddenKeys) ? data.hiddenKeys : []);
            setInstitutionId(
              Number.isFinite(data.institutionId) ? data.institutionId : null
            );
          }
        } else if (!cancelled) {
          setHiddenKeys([]);
          setInstitutionId(null);
        }
      } catch {
        if (!cancelled) {
          setHiddenKeys([]);
          setInstitutionId(null);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hiddenSet = useMemo(() => new Set(hiddenKeys ?? []), [hiddenKeys]);

  return {
    hiddenKeys: hiddenKeys ?? [],
    hiddenSet,
    institutionId,
    isLoading: hiddenKeys === null,
    isHidden: (key: string) => hiddenSet.has(key),
  };
}