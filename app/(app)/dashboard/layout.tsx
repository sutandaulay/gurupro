"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import TopBar from "@/app/components/layout/TopBar";
import MenuBar from "@/app/components/layout/MenuBar";
import MobileSidebar from "@/app/components/layout/Sidebar";
import SessionSync from "@/app/components/SessionSync";

const StoragePage = dynamic(
  () => import("@/app/components/storage/StoragePage"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);

  useEffect(() => {
    setStorageOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SessionSync />
      <TopBar onToggleSidebar={() => setSidebarOpen(true)} />
      <MenuBar
        onStorageClick={() => setStorageOpen((prev) => !prev)}
      />
      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onStorageClick={() => setStorageOpen((prev) => !prev)}
      />
      <main className="flex-1">
        {storageOpen ? <StoragePage /> : children}
      </main>
    </div>
  );
}
