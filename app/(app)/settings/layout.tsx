'use client';

import { SidebarNav } from '@/components/settings/sidebar-nav';
import { Separator } from '@/components/ui/separator';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const sidebarNavItems = [
    {
      title: 'Profil',
      href: '/settings',
    },
    {
      title: 'Keamanan',
      href: '/settings/security',
    },
    {
      title: 'Wajah',
      href: '/settings/face',
    },
    {
      title: 'Notifikasi',
      href: '/settings/notifications',
    },
  ];

  return (
    <div className="flex">
      <aside className="md:w-64 pr-4 md:pr-8">
        <SidebarNav items={sidebarNavItems} />
      </aside>
      <Separator orientation="vertical" className="hidden md:block h-auto mx-4" />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}