"use client";

import { useState, useEffect } from "react";
import InstitutionTopBar from "./InstitutionTopBar";
import InstitutionSidebar from "./InstitutionSidebar";

interface InstitutionShellProps {
  institutionId: number;
  institutionName: string;
  userRoles: string[];
  children: React.ReactNode;
}

export default function InstitutionShell({
  institutionId,
  institutionName,
  userRoles,
  children,
}: InstitutionShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inst_sidebar_open");
      if (saved !== null) {
        setSidebarOpen(saved === "true");
      }
    }
  }, []);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("inst_sidebar_open", String(next));
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <InstitutionTopBar
        institutionName={institutionName}
        onToggleSidebar={handleToggleSidebar}
        userRoles={userRoles}
      />
      <div className="flex-1 pt-16 flex flex-row">
        <InstitutionSidebar
          institutionId={institutionId}
          userRoles={userRoles}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main
          className={`flex-1 relative pb-24 md:pb-0 min-w-0 transition-all duration-300 ease-in-out ${
            sidebarOpen ? "md:pl-64" : "md:pl-0"
          }`}
        >
          <div className="md:max-w-[1400px] md:mx-auto md:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
