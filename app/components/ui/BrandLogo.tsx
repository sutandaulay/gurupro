"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";

/**
 * BrandLogo — logo GuruPRO yang SELALU memakai logo yang diupload admin di
 * menu Integrasi Sistem (app_branding.app_logo).
 *
 * Jika belum/setelah diupload, tampilkan `fallback` (tampilan lama).
 * Hasil fetch di-cache per session agar tidak dobel request.
 */
interface BrandingResp {
  app_name?: string;
  app_logo?: string;
}

let cachedBranding: BrandingResp | null | undefined;
let brandingPromise: Promise<BrandingResp | null> | null = null;

function loadBranding(): Promise<BrandingResp | null> {
  if (cachedBranding) return Promise.resolve(cachedBranding);
  if (!brandingPromise) {
    brandingPromise = apiFetch("/api/branding")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => {
        cachedBranding = data;
        return data;
      });
  }
  return brandingPromise;
}

export default function BrandLogo({
  className = "",
  alt,
  fallback,
}: {
  className?: string;
  alt?: string;
  fallback?: React.ReactNode;
}) {
  const [branding, setBranding] = useState<BrandingResp | null>(cachedBranding ?? null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (cachedBranding === undefined) {
      loadBranding().then((data) => {
        if (mounted.current) setBranding(data);
      });
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  if (branding?.app_logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branding.app_logo}
        alt={alt || branding.app_name || "Logo"}
        className={`object-contain ${className}`}
      />
    );
  }

  return <>{fallback ?? null}</>;
}