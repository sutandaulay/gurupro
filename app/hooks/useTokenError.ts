/**
 * useTokenError Hook
 *
 * Handles INSUFFICIENT_TOKEN errors and triggers appropriate UI responses.
 * Integrates with the token consumption flow.
 *
 * Usage:
 * ```tsx
 * const { handleTokenError, showTokenModal, shortfall } = useTokenError();
 *
 * // In your AI action:
 * if (result.error === 'INSUFFICIENT_TOKEN') {
 *   handleTokenError(result.shortfall);
 * }
 *
 * return (
 *   <>
 *     <AIComponent />
 *     {showTokenModal && <TokenHabisModal shortfall={shortfall} />}
 *   </>
 * );
 * ```
 */

"use client";

import { useState, useCallback } from "react";

export interface TokenErrorInfo {
  error: "INSUFFICIENT_TOKEN" | "SUBSCRIPTION_EXPIRED" | "SUBSCRIPTION_LOCKED";
  shortfall?: number;
  currentMain?: number;
  currentAddon?: number;
  message: string;
}

interface UseTokenErrorReturn {
  tokenError: TokenErrorInfo | null;
  showTokenModal: boolean;
  shortfall: number;
  handleTokenError: (error: Partial<TokenErrorInfo>) => void;
  closeModal: () => void;
  openTopUpModal: () => void;
  showTopUp: boolean;
}

export function useTokenError(): UseTokenErrorReturn {
  const [tokenError, setTokenError] = useState<TokenErrorInfo | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);

  const handleTokenError = useCallback((error: Partial<TokenErrorInfo>) => {
    const errorInfo: TokenErrorInfo = {
      error: error.error || "INSUFFICIENT_TOKEN",
      shortfall: error.shortfall,
      currentMain: error.currentMain,
      currentAddon: error.currentAddon,
      message: error.message || "Poin tidak mencukupi untuk melanjutkan.",
    };

    setTokenError(errorInfo);
    setShowTokenModal(true);
    setShowTopUp(false);
  }, []);

  const closeModal = useCallback(() => {
    setShowTokenModal(false);
    setTokenError(null);
  }, []);

  const openTopUpModal = useCallback(() => {
    setShowTopUp(true);
  }, []);

  return {
    tokenError,
    showTokenModal,
    shortfall: tokenError?.shortfall || 0,
    handleTokenError,
    closeModal,
    openTopUpModal,
    showTopUp,
  };
}

/**
 * Parse API error response to TokenErrorInfo
 */
export function parseTokenError(error: any): Partial<TokenErrorInfo> {
  if (typeof error === "string") {
    return { message: error };
  }

  if (error?.error === "INSUFFICIENT_TOKEN") {
    return {
      error: "INSUFFICIENT_TOKEN",
      shortfall: error.shortfall,
      currentMain: error.currentMain,
      currentAddon: error.currentAddon,
      message: `Poin tidak mencukupi. Butuh ${error.shortfall || 0} poin lagi.`,
    };
  }

  if (error?.error === "SUBSCRIPTION_EXPIRED") {
    return {
      error: "SUBSCRIPTION_EXPIRED",
      message: "Masa langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.",
    };
  }

  if (error?.error === "SUBSCRIPTION_LOCKED") {
    return {
      error: "SUBSCRIPTION_LOCKED",
      message: "Akun Anda terkunci. Harap hubungi admin untuk bantuan.",
    };
  }

  return {
    message: error?.message || "Terjadi kesalahan. Silakan coba lagi.",
  };
}
