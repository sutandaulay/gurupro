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
} from "@tabler/icons-react";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
  { label: "Perencanaan", href: "/dashboard/perencanaan", icon: IconCalendarDue },
  { label: "Administrasi", href: "/dashboard/administrasi", icon: IconFileSpreadsheet },
  { label: "Nilai", href: "/dashboard/nilai", icon: IconChartBar },
  { label: "Pengembangan", href: "/dashboard/pengembangan", icon: IconUsers },
  { label: "Komunikasi", href: "/dashboard/komunikasi", icon: IconMessage },
];

export default function MenuBar() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex h-12 bg-white border-b border-gray-200 px-6">
      <div className="flex items-center gap-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 transition-all duration-150 ${
                isActive
                  ? "text-violet-600 border-violet-600 bg-violet-50"
                  : "text-gray-600 border-transparent hover:text-violet-500 hover:bg-violet-50"
              }`}
            >
              <Icon size={18} stroke={1.5} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
