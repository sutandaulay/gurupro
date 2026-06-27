"use client";

import { useState } from "react";
import TopBar from "../components/layout/TopBar";
import MenuBar from "../components/layout/MenuBar";
import MobileSidebar from "../components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar onToggleSidebar={() => setSidebarOpen(true)} />
      <MenuBar />
      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
