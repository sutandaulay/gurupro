"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMenuVisibility } from "@/hooks/useMenuVisibility";
import { getHiddenFeatureHrefs, normalizeCurrentPath } from "@/lib/menuConfig";

/**
 * Guard akses sisi client untuk rute fitur tersembunyi.
 * Bila URL aktif adalah milik feature (menu/submenu/modul) yang disembunyikan
 * oleh admin, tampilkan layar blokir alih-alih merender konten.
 */
export default function FeatureAccessGate({
  children,
}: {
  children: ReactNode;
}) {
  const { hiddenSet, isLoading } = useMenuVisibility();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const blocked = useMemo(() => {
    if (isLoading || hiddenSet.size === 0) return false;
    const hiddenRoutes = getHiddenFeatureHrefs(Array.from(hiddenSet));
    return hiddenRoutes.has(normalizeCurrentPath(pathname, searchParams));
  }, [hiddenSet, isLoading, pathname, searchParams]);

  if (blocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mb-4">
          🔒
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Fitur tidak tersedia
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Fitur ini telah disembunyikan untuk peran Anda di institusi ini oleh
          administrator.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}