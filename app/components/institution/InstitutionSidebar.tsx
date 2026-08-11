"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconUsers,
  IconReceipt,
  IconCheck,
  IconCreditCard,
  IconSettings,
  IconActivity,
  IconGauge,
  IconFileText,
  IconAlertTriangle,
  IconClipboardCheck,
  IconLayoutKanban,
  IconChartBar,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";

interface InstitutionSidebarProps {
  institutionId: number;
  userRoles: string[];
  isOpen: boolean;
  onClose: () => void;
}

const allMenuItems = [
  {
    section: "Utama",
    items: [
      {
        label: "Command Center",
        href: "command-center",
        icon: IconGauge,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Ringkasan Laporan",
        href: "ringkasan",
        icon: IconActivity,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Draf Surat AI",
        href: "surat",
        icon: IconFileText,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Smart Alert",
        href: "alerts",
        icon: IconAlertTriangle,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Approval Queue",
        href: "queue",
        icon: IconClipboardCheck,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Kanban Task",
        href: "kanban",
        icon: IconLayoutKanban,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "PKG Digital",
        href: "pkg",
        icon: IconChartBar,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Akreditasi",
        href: "akreditasi",
        icon: IconShieldCheck,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Proses Mengajar",
        href: "review-proses",
        icon: IconClipboardCheck,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Overview",
        href: "dashboard",
        icon: IconLayoutDashboard,
        roles: ["kepala_sekolah", "operator"],
      },
      {
        label: "Manajemen Guru",
        href: "guru",
        icon: IconUsers,
        roles: ["kepala_sekolah", "operator"],
      },
      {
        label: "Aktivitas Guru",
        href: "aktivitas",
        icon: IconActivity,
        roles: ["kepala_sekolah", "operator"],
      },
      {
        label: "Rekap TPG",
        href: "tpg",
        icon: IconReceipt,
        roles: ["kepala_sekolah", "operator"],
      },
    ],
  },
  {
    section: "Strategis",
    items: [
      {
        label: "Approval / Persetujuan",
        href: "approval",
        icon: IconCheck,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Review Raport",
        href: "wakasek",
        icon: IconCheck,
        roles: ["kepala_sekolah", "wakasek"],
      },
      {
        label: "Keuangan Poin",
        href: "bendahara",
        icon: IconCreditCard,
        roles: ["kepala_sekolah", "bendahara"],
      },
      {
        label: "Langganan & Billing",
        href: "langganan",
        icon: IconCreditCard,
        roles: ["kepala_sekolah"],
      },
      {
        label: "Pengaturan Institusi",
        href: "pengaturan",
        icon: IconSettings,
        roles: ["kepala_sekolah"],
      },
    ],
  },
];

export default function InstitutionSidebar({
  institutionId,
  userRoles,
  isOpen,
  onClose,
}: InstitutionSidebarProps) {
  const pathname = usePathname();
  const basePath = `/institusi/${institutionId}/dashboard`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-50 md:z-auto
          h-screen w-64 bg-white border-r border-gray-200
          transform transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:min-w-0 md:overflow-hidden md:border-none"}
          flex flex-col
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 min-h-[65px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {institutionId}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                Dashboard Institusi
              </p>
              <p className="text-[11px] text-gray-400 truncate">ID: {institutionId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-gray-600 cursor-pointer p-1"
            type="button"
          >
            <IconX size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {allMenuItems.map((group) => {
            const visibleItems = group.items.filter((item) =>
              item.roles.some((r) => userRoles.includes(r))
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.section} className="mb-4">
                <div className="px-4 mb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  {group.section}
                </div>
                {visibleItems.map((item) => {
                  const href = `${basePath}/${item.href}`;
                  const isActive =
                    pathname === href ||
                    (item.href !== "dashboard" && pathname.startsWith(`${href}/`));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={href}
                      className={`
                        flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm
                        transition-colors cursor-pointer mb-0.5
                        ${isActive ? "bg-violet-50 text-violet-700 font-medium" : "text-gray-600 hover:bg-gray-50"}
                      `}
                      onClick={onClose}
                    >
                      <Icon size={18} stroke={1.5} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
