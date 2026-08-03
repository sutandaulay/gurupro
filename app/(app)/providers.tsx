"use client";

import React, { createContext, useContext, useState, useEffect, Component, ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/app/components/ui/toast";
import PendingInvitationModal from "@/components/auth/PendingInvitationModal";
import ReferralModal from "@/components/auth/ReferralModal";

// Error boundary to prevent auth errors from crashing the entire app
class AuthErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('[AuthErrorBoundary] Caught auth error:', error?.message || error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

// Buat context untuk menyimpan data session dan sekolah
interface GlobalContextType {
  gurupro_session: string | null;
  gurupro_school_selected: string | null;
  setSessionData: (session: string | null) => void;
  setSchoolData: (school: string | null) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

// Fungsi untuk mengambil data dari server (akan dipanggil di wrapper)
export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalContext must be used within a Providers context');
  }
  return context;
}

// Provider default yang menerima data dari server melalui props
export default function Providers({ 
  children, 
  gurupro_session, 
  gurupro_school_selected 
}: { 
  children: React.ReactNode;
  gurupro_session?: string;
  gurupro_school_selected?: string;
}) {
  const [sessionData, setSessionData] = useState<string | null>(gurupro_session || null);
  const [schoolData, setSchoolData] = useState<string | null>(gurupro_school_selected || null);

  // Update state jika props berubah
  useEffect(() => {
    setSessionData(gurupro_session || null);
  }, [gurupro_session]);

  useEffect(() => {
    setSchoolData(gurupro_school_selected || null);
  }, [gurupro_school_selected]);

  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [invitationProcessed, setInvitationProcessed] = useState(false);

  // Check localStorage on mount to decide which modal to show
  useEffect(() => {
    const hasInvitation = !!localStorage.getItem("pending_invitation_token");
    const hasReferral = !!localStorage.getItem("referral_code");

    if (hasInvitation) {
      setShowInvitationModal(true);
    } else if (hasReferral) {
      setShowReferralModal(true);
    }

    // Apply saved theme on mount
    try {
      const savedPref = localStorage.getItem("gurupro_user_preferences");
      if (savedPref) {
        const parsed = JSON.parse(savedPref);
        if (parsed.tema) {
          const root = document.documentElement;
          root.classList.remove("dark", "light");
          if (parsed.tema === "dark") {
            root.classList.add("dark");
            document.body.classList.add("dark");
          } else if (parsed.tema === "light") {
            root.classList.add("light");
            document.body.classList.remove("dark");
          } else {
            const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            if (isSystemDark) { root.classList.add("dark"); document.body.classList.add("dark"); }
            else { root.classList.add("light"); document.body.classList.remove("dark"); }
          }
        }
      } else {
        // Default: light theme (not system) unless user explicitly saved a preference
        document.documentElement.classList.add("light");
        document.body.classList.remove("dark");
      }
    } catch { /* ignore */ }

    // Sync theme when changed elsewhere (e.g. ThemeToggle di TopBar/Navbar)
    const handleThemeChanged = () => {
      const savedPref = localStorage.getItem("gurupro_user_preferences");
      const parsed = savedPref ? JSON.parse(savedPref) : {};
      const tema = parsed.tema || "light";
      const root = document.documentElement;
      root.classList.remove("dark", "light");
      if (tema === "dark") {
        root.classList.add("dark");
        document.body.classList.add("dark");
      } else if (tema === "light") {
        root.classList.add("light");
        document.body.classList.remove("dark");
      } else {
        const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (isSystemDark) { root.classList.add("dark"); document.body.classList.add("dark"); }
        else { root.classList.add("light"); document.body.classList.remove("dark"); }
      }
    };
    window.addEventListener("gurupro_theme_changed", handleThemeChanged);
    return () => window.removeEventListener("gurupro_theme_changed", handleThemeChanged);
  }, []);

  return (
    <GlobalContext.Provider value={{
      gurupro_session: sessionData,
      gurupro_school_selected: schoolData,
      setSessionData,
      setSchoolData
    }}>
      <AuthErrorBoundary>
        <SessionProvider>
          <ToastProvider>
          {children}
          {/* Only show one modal at a time */}
          {showInvitationModal && (
            <PendingInvitationModal
              onAccepted={() => {
                setShowInvitationModal(false);
                setInvitationProcessed(true);
                // Check for referral after invitation processed
                setTimeout(() => {
                  const hasReferral = !!localStorage.getItem("referral_code");
                  if (hasReferral) {
                    setShowReferralModal(true);
                  }
                }, 500);
              }}
            />
          )}
          {showReferralModal && !showInvitationModal && (
            <ReferralModal
              onProcessed={() => {
                setShowReferralModal(false);
              }}
            />
          )}
          </ToastProvider>
        </SessionProvider>
      </AuthErrorBoundary>
    </GlobalContext.Provider>
  );
}