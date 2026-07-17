"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import TopBar from "@/app/components/layout/TopBar";
import Sidebar from "@/app/components/layout/Sidebar";
import SessionSync from "@/app/components/SessionSync";
import ReferralProcessor from "@/app/(app)/components/ReferralProcessor";



export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tokenStatus, setTokenStatus] = useState<any>(null);

  // Fetch token/subscription status to display alerts if needed
  useEffect(() => {
    const fetchTokenStatus = async () => {
      try {
        const res = await fetch("/api/user/token-status");
        if (res.ok) {
          const data = await res.json();
          setTokenStatus(data);
        }
      } catch (err) {
        console.error("Gagal memuat status token di layout:", err);
      }
    };

    fetchTokenStatus();

    // Listen to token updates
    window.addEventListener("gurupro_token_updated", fetchTokenStatus);
    return () => window.removeEventListener("gurupro_token_updated", fetchTokenStatus);
  }, []);

  // Dispatch custom event to sync sidebar toggled state with dashboard page cleanly after render
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gurupro_sidebar_toggled", { detail: sidebarOpen }));
    }
  }, [sidebarOpen]);

  // Initialize sidebar preference on client-side mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setSidebarOpen(false);
      } else {
        const saved = localStorage.getItem("gurupro_sidebar_open");
        if (saved !== null) {
          setSidebarOpen(saved === "true");
        }
      }
    }
  }, []);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const nextState = !prev;
      if (typeof window !== "undefined" && window.innerWidth >= 768) {
        localStorage.setItem("gurupro_sidebar_open", String(nextState));
      }
      return nextState;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SessionSync />
      <ReferralProcessor />
      <TopBar onToggleSidebar={handleToggleSidebar} />
      <div className="flex-1 pt-16 flex flex-row">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main
          className={`flex-1 relative pb-24 md:pb-0 min-w-0 transition-all duration-300 ease-in-out ${
            sidebarOpen ? "md:pl-64" : "md:pl-0"
          }`}
        >
          {/* Grace Period Alert Banner */}
          {tokenStatus?.subscription_status === "grace_period" && tokenStatus?.grace_period_ends_at && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-850 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 animate-fade-in shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">⚠️</span>
                <span>
                  Masa aktif langganan Anda telah berakhir. Akun Anda saat ini berada dalam <strong>Masa Tenggang</strong> dan akan dinonaktifkan pada <strong>{new Date(tokenStatus.grace_period_ends_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong>.
                </span>
              </div>
              <a
                href="/dashboard/billing"
                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 text-center"
              >
                Perpanjang Sekarang
              </a>
            </div>
          )}

          <div className="md:max-w-[1400px] md:mx-auto md:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
