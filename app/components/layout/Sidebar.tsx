"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  IconX,
  IconLayoutDashboard,
  IconCalendarDue,
  IconFileSpreadsheet,
  IconChartBar,
  IconUsers,
  IconMessage,
  IconLogout,
  IconCapRounded,
  IconFileText,
  IconListCheck,
  IconTimeline,
  IconBrain,
} from "@tabler/icons-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
  { label: "Perencanaan", href: "/dashboard/perencanaan", icon: IconCalendarDue },
  { label: "Administrasi", href: "/dashboard/administrasi", icon: IconFileSpreadsheet },
  { label: "Nilai", href: "/dashboard/nilai", icon: IconChartBar },
  { label: "Pengembangan", href: "/dashboard/pengembangan", icon: IconUsers },
  { label: "Komunikasi", href: "/dashboard/komunikasi", icon: IconMessage },
  { label: "Chat AI", href: "/dashboard/chat", icon: IconMessage },
];

// Deep Learning menu items
const deepLearningItems = [
  { label: "ATP Editor", href: "/dashboard/atp-editor", icon: IconTimeline, badge: "NEW" },
  { label: "Program Tahunan (Prota)", href: "/dashboard/prota", icon: IconListCheck, badge: "NEW" },
  { label: "Program Semester (Prosem)", href: "/dashboard/prosem", icon: IconFileText, badge: "NEW" },
  { label: "AI Modul Ajar", href: "/dashboard/administrasi", icon: IconBrain, badge: "✨" },
];

export default function MobileSidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "GP";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[280px] bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <IconCapRounded size={26} stroke={1.5} className="text-violet-600" />
            <span className="text-lg font-bold text-gray-900">
              Guru<span className="text-violet-600">PRO</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <IconX size={20} stroke={1.5} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 overflow-y-auto" style={{ height: "calc(100% - 140px)" }}>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 mx-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-violet-50 text-violet-600 border-l-3 border-violet-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={20} stroke={1.5} />
                {item.label}
              </Link>
            );
          })}

          {/* Deep Learning Section */}
          <div className="mx-2 mt-4 mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-2">
              ✨ Deep Learning (Kerangka 8334)
            </p>
          </div>
          {deepLearningItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 mx-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-600 border-l-3 border-emerald-500"
                    : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-600"
                }`}
              >
                <Icon size={20} stroke={1.5} />
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
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4 bg-white">
          <div className="flex items-center gap-3 mb-3">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {session?.user?.name || "Pengguna"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session?.user?.email || ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <IconLogout size={16} stroke={1.5} />
            Keluar
          </button>
        </div>
      </div>
    </>
  );
}
