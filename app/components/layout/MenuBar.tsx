"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconCalendarDue,
  IconFileSpreadsheet,
  IconChartBar,
  IconUsers,
  IconMessage,
  IconFileText,
  IconListCheck,
  IconTimeline,
  IconBrain,
} from "@tabler/icons-react";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
  { label: "Perencanaan", href: "/dashboard/perencanaan", icon: IconCalendarDue },
  { label: "Administrasi", href: "/dashboard/administrasi", icon: IconFileSpreadsheet },
  { label: "Nilai", href: "/dashboard/nilai", icon: IconChartBar },
  { label: "Pengembangan", href: "/dashboard/pengembangan", icon: IconUsers },
  { label: "Komunikasi", href: "/dashboard/komunikasi", icon: IconMessage },
];

// Deep Learning submenu items
const deepLearningItems = [
  { label: "ATP Editor", href: "/dashboard/atp-editor", icon: IconTimeline, badge: "NEW" },
  { label: "Program Tahunan", href: "/dashboard/prota", icon: IconListCheck, badge: "NEW" },
  { label: "Program Semester", href: "/dashboard/prosem", icon: IconFileText, badge: "NEW" },
  { label: "AI Modul Ajar", href: "/dashboard/administrasi", icon: IconBrain, badge: "✨" },
];

export default function MenuBar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const isDeepLearningActive = deepLearningItems.some(item => isActive(item.href));

  return (
    <nav className="hidden lg:flex h-12 bg-white border-b border-gray-200 px-6">
      <div className="flex items-center gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 ${
                active
                  ? "text-violet-600 border-violet-600 bg-violet-50"
                  : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
              }`}
            >
              <Icon size={18} stroke={1.5} />
              {item.label}
            </Link>
          );
        })}

        {/* Deep Learning Menu */}
        <div className="relative group">
          <Link
            href="/dashboard/atp-editor"
            className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 ${
              isDeepLearningActive
                ? "text-violet-600 border-violet-600 bg-violet-50"
                : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
            }`}
          >
            <IconBrain size={18} stroke={1.5} />
            Deep Learning
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Link>

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="p-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2">
                ✨ Fitur Baru - Kerangka 8334
              </p>
              {deepLearningItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-violet-50 text-violet-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={18} stroke={1.5} className={active ? "text-violet-500" : "text-gray-400"} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        item.badge === "NEW"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-gray-100 p-3 bg-gray-50 rounded-b-xl">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                8 Dimensi Profil Lulusan • 3 Pengalaman Belajar • PAI Hybrid Mode
              </p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
