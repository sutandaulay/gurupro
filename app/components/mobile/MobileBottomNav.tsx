"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Clock, ClipboardList, BookOpen } from "lucide-react";
import AppIcon from "@/app/components/ui/AppIcon";
import { resolveCategory, menuFeatureKey, moduleFeatureKey } from "@/lib/menuConfig";
import { useMenuVisibility } from "@/hooks/useMenuVisibility";

const BOTTOM_ITEMS = [
  {
    id: "dashboard",
    label: "Dasbor",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "presensi",
    label: "Presensi",
    href: "/attendance",
    icon: Clock,
  },
  {
    id: "jurnal",
    label: "Jurnal",
    href: "/dashboard?module=jurnal",
    icon: ClipboardList,
  },
  {
    id: "nilai",
    label: "Nilai",
    href: "/dashboard?module=nilai",
    icon: BookOpen,
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hiddenSet } = useMenuVisibility();

  const visibleItems = BOTTOM_ITEMS.filter((item) => {
    if (item.id === "dasbor") return !hiddenSet.has(menuFeatureKey("dasbor"));
    if (item.href.includes("?module=")) {
      const mod = item.href.split("=")[1];
      return !hiddenSet.has(moduleFeatureKey(mod));
    }
    return true;
  });

  const isActive = (item: typeof BOTTOM_ITEMS[0]) => {
    if (item.href.includes("?module=")) {
      const mod = item.href.split("=")[1];
      if (pathname === "/dashboard" && searchParams.get("module") === mod) return true;
      return false;
    }
    return pathname === item.href || pathname.startsWith(item.href + "?");
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.includes("?module=")) {
      e.preventDefault();
      const mod = href.split("=")[1];
      window.dispatchEvent(new CustomEvent("switchModule", { detail: { module: mod } }));
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-slate-200/80 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {visibleItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={(e) => handleClick(e, item.href)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full min-h-[48px] transition-colors duration-200 ${
                active ? "text-violet-600" : "text-slate-400"
              }`}
            >
              <AppIcon
                label={item.label}
                size={36}
                iconSize={18}
                category={resolveCategory(item.label)}
                active={active}
                icon={<item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />}
              />
              <span className={`text-[10px] font-medium ${active ? "text-violet-600" : "text-slate-400"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
