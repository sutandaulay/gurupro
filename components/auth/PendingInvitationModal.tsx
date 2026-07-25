"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import {
  IconSchool,
  IconLoader2,
  IconX,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

interface PendingInvitationData {
  invitationId: number;
  institutionId: number;
  institutionName: string;
  institutionLogo: string | null;
  invitedEmail: string | null;
  invitedPhone: string | null;
  expiresAt: string | null;
}

interface PendingInvitationModalProps {
  onAccepted?: () => void;
  onDismissed?: () => void;
}

export default function PendingInvitationModal({
  onAccepted,
  onDismissed,
}: PendingInvitationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitation, setInvitation] = useState<PendingInvitationData | null>(null);
  const [checking, setChecking] = useState(true);
  const [localStorageToken, setLocalStorageToken] = useState<string | null>(null);

  // Check for pending invitation on mount — but only AFTER session cookie is set
  useEffect(() => {
    // Poll/observe for gurupro_session cookie (set by SessionSync)
    // We need to wait for SessionSync to complete first
    const checkPendingInvitation = async () => {
      try {
        // Wait briefly for SessionSync to set the gurupro_session cookie
        // (it runs in parallel with this useEffect on first render)
        let cookieSet = false;
        for (let i = 0; i < 10; i++) {
          const cookies = document.cookie.split("; ");
          cookieSet = cookies.some((c) => c.startsWith("gurupro_session="));
          if (cookieSet) break;
          await new Promise((r) => setTimeout(r, 100));
        }

        if (!cookieSet) {
          // SessionSync hasn't run yet — skip for now (will re-check on page refresh)
          setChecking(false);
          return;
        }

        // First check localStorage for token (covers Google OAuth + invitation URL case)
        const storedToken = localStorage.getItem("pending_invitation_token");
        const storedSchoolName = localStorage.getItem("pending_invitation_school");
        const storedSchoolLogo = localStorage.getItem("pending_invitation_logo");

        if (storedToken) {
          setLocalStorageToken(storedToken);

          // If we have school info in localStorage, show modal immediately
          if (storedSchoolName) {
            setInvitation({
              invitationId: 0,
              institutionId: 0,
              institutionName: storedSchoolName,
              institutionLogo: storedSchoolLogo,
              invitedEmail: null,
              invitedPhone: null,
              expiresAt: null,
            });
            setIsOpen(true);
            setChecking(false);
            return;
          }
        }

        // Otherwise check API (for users who registered via form with invitation)
        const res = await apiFetch("/api/auth/invitation/pending");
        if (res.ok) {
          const data = await res.json();
          if (data.hasPending && data.invitation) {
            setInvitation(data.invitation);
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error("Failed to check pending invitation:", err);
      } finally {
        setChecking(false);
      }
    };

    checkPendingInvitation();
  }, []);

  const [showReferralPrompt, setShowReferralPrompt] = useState(false);

  const handleAccept = async () => {
    if (!localStorageToken && !invitation) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/auth/invitation/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: localStorageToken }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        // Clear invitation from localStorage
        localStorage.removeItem("pending_invitation_token");
        localStorage.removeItem("pending_invitation_school");
        localStorage.removeItem("pending_invitation_logo");

        // Check for referral code after invitation accepted
        const referralCode = localStorage.getItem("referral_code");
        if (referralCode) {
          // Show referral prompt
          setShowReferralPrompt(true);
          setTimeout(() => {
            setIsOpen(false);
            onAccepted?.();
          }, 1500);
        } else {
          // No referral code, just close
          setTimeout(() => {
            setIsOpen(false);
            onAccepted?.();
          }, 1500);
        }
      } else {
        setError(data.error || "Gagal bergabung dengan sekolah");
      }
    } catch (err) {
      console.error("Accept invitation error:", err);
      setError("Terjadi masalah koneksi");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    // Keep localStorage for now (user can accept later)
    setIsOpen(false);
    onDismissed?.();
  };

  // Don't render anything while checking or if no pending invitation
  if (checking || (!isOpen && !invitation)) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <IconSchool size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Undangan Bergabung
                  </h3>
                  <p className="text-violet-200 text-sm">neo-gurupro</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {success ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconCheck size={32} className="text-success-600" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">
                    Berhasil Bergabung!
                  </h4>
                  <p className="text-sm text-slate-600">
                    Anda sekarang terhubung dengan {invitation?.institutionName}
                  </p>
                </div>
              ) : (
                <>
                  {/* School Info */}
                  <div className="bg-slate-50 rounded-xl p-4 mb-5">
                    <div className="flex items-center gap-4">
                      {invitation?.institutionLogo ? (
                        <img
                          src={invitation.institutionLogo}
                          alt={invitation.institutionName}
                          className="w-14 h-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center">
                          <IconSchool size={28} className="text-violet-600" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900">
                          {invitation?.institutionName}
                        </h4>
                        <p className="text-sm text-slate-500">
                          Mengundang Anda untuk bergabung
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-3 mb-5">
                    <p className="text-sm text-slate-600">
                      Bergabung dengan sekolah ini akan memberikan akses ke:
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm text-slate-700">
                        <IconCheck size={16} className="text-success-500" />
                        Presensi dan jurnal mengajar
                      </li>
                      <li className="flex items-center gap-2 text-sm text-slate-700">
                        <IconCheck size={16} className="text-success-500" />
                        Laporan dan statistik sekolah
                      </li>
                      <li className="flex items-center gap-2 text-sm text-slate-700">
                        <IconCheck size={16} className="text-success-500" />
                        Koordinasi dengan kepala sekolah
                      </li>
                    </ul>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg flex items-start gap-2">
                      <IconAlertCircle size={18} className="text-error-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-error-700">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleDismiss}
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Nanti Saja
                    </button>
                    <button
                      onClick={handleAccept}
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <IconLoader2 size={16} className="animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <IconCheck size={16} />
                          Bergabung
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-center text-xs text-slate-400 mt-4">
                    Anda bisa bergabung nanti melalui menu pengaturan
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
