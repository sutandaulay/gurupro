"use client";

import { IconMenu2, IconLogout, IconBuilding } from "@tabler/icons-react";

const ROLE_LABELS: Record<string, string> = {
  kepala_sekolah: "Kepala Sekolah",
  wakasek: "Wakil Kepala Sekolah",
  operator: "Operator",
  admin_sekolah: "Admin Sekolah",
  bendahara: "Bendahara",
  guru: "Guru",
  wali_kelas: "Wali Kelas",
  pembina_ekskul: "Pembina Ekskul",
};

function getRoleLabel(userRoles: string[]): string {
  if (userRoles.length === 0) return "";
  const firstRole = userRoles[0];
  return ROLE_LABELS[firstRole] ?? firstRole;
}

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
  const roleLabel = getRoleLabel(userRoles);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="flex p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer shrink-0"
          type="button"
          aria-label="Toggle menu"
        >
          <IconMenu2 size={22} />
        </button>
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shrink-0">
          <IconBuilding size={18} stroke={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate max-w-[320px]">
            {institutionName}
          </p>
          <p className="text-[11px] text-gray-500">— {roleLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
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
