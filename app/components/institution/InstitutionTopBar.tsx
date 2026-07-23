"use client";

import { IconMenu2, IconLogout, IconBuilding } from "@tabler/icons-react";

interface InstitutionTopBarProps {
  institutionName: string;
  onToggleSidebar: () => void;
  userRoles: string[];
}

export default function InstitutionTopBar({
  institutionName,
  onToggleSidebar,
  userRoles,
}: InstitutionTopBarProps) {
  const roleLabel =
    userRoles.includes("kepala_sekolah") ? "Kepala Sekolah" : "Operator";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="hidden md:flex p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
          type="button"
        >
          <IconMenu2 size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white">
            <IconBuilding size={18} stroke={1.5} />
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate max-w-[240px]">
              {institutionName}
            </p>
            <p className="text-[11px] text-gray-500">{roleLabel}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="/dashboard"
          className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Dashboard Individual
        </a>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <IconLogout size={16} />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </form>
      </div>
    </header>
  );
}
