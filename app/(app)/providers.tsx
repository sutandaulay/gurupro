"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/app/components/ui/toast";
import PendingInvitationModal from "@/components/auth/PendingInvitationModal";
import ReferralModal from "@/components/auth/ReferralModal";

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
  }, []);

  return (
    <GlobalContext.Provider value={{
      gurupro_session: sessionData,
      gurupro_school_selected: schoolData,
      setSessionData,
      setSchoolData
    }}>
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
    </GlobalContext.Provider>
  );
}