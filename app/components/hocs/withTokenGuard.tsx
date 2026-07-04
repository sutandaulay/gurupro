/**
 * withTokenGuard Higher-Order Component
 *
 * Wraps AI-powered components with automatic token checking.
 * Shows loading state during checks and handles errors gracefully.
 *
 * Usage:
 * ```tsx
 * // WrappedComponent.tsx
 * export const WrappedRPPGenerator = withTokenGuard(RPPGenerator, {
 *   featureName: 'Generator RPP',
 *   requiredTokens: 2,
 * });
 * ```
 */

"use client";

import { ComponentType, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import TokenHabisModal from "@/app/components/ui/TokenHabisModal";

interface WithTokenGuardOptions {
  featureName: string;
  requiredTokens?: number;
  redirectToLogin?: boolean;
  customFallback?: ComponentType<{ isLoading: boolean }>;
}

interface TokenStatus {
  isLoading: boolean;
  hasAccess: boolean;
  reason?: "no_session" | "expired" | "no_tokens" | "locked";
  remainingTokens?: number;
  error?: string;
}

export function withTokenGuard<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithTokenGuardOptions
) {
  const {
    featureName,
    requiredTokens = 1,
    redirectToLogin = true,
    customFallback: CustomFallback,
  } = options;

  function TokenGuardedComponent(props: P & { children?: ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [tokenStatus, setTokenStatus] = useState<TokenStatus>({
      isLoading: status === "loading",
      hasAccess: false,
    });
    const [showErrorModal, setShowErrorModal] = useState(false);

    useEffect(() => {
      async function checkTokenAccess() {
        try {
          const res = await fetch("/api/user/token-status");
          if (!res.ok) {
            if (res.status === 401 && redirectToLogin) {
              router.push("/login");
              return;
            }
            throw new Error("Failed to check token status");
          }

          const data = await res.json();

          const hasTokens =
            (data.token_limit || 0) + (data.addon_token_balance || 0) >=
            requiredTokens;
          const isExpired =
            data.subscription_end &&
            new Date(data.subscription_end).getTime() < Date.now();
          const isLocked = data.subscription_status === "locked";

          let reason: TokenStatus["reason"] = undefined;
          let hasAccess = true;

          if (!session) {
            reason = "no_session";
            hasAccess = false;
            if (redirectToLogin) {
              router.push("/login");
            }
          } else if (isLocked) {
            reason = "locked";
            hasAccess = false;
            setShowErrorModal(true);
          } else if (isExpired) {
            reason = "expired";
            hasAccess = false;
            setShowErrorModal(true);
          } else if (!hasTokens) {
            reason = "no_tokens";
            hasAccess = false;
            setShowErrorModal(true);
          }

          setTokenStatus({
            isLoading: false,
            hasAccess,
            reason,
            remainingTokens: (data.token_limit || 0) + (data.addon_token_balance || 0),
          });
        } catch (error: any) {
          setTokenStatus({
            isLoading: false,
            hasAccess: false,
            error: error.message,
          });
          console.error(`[TokenGuard] ${featureName}: Failed to check access`, error);
        }
      }

      if (status !== "loading") {
        checkTokenAccess();
      }
    }, [status, session, router, redirectToLogin]);

    // Loading state
    if (tokenStatus.isLoading || status === "loading") {
      if (CustomFallback) {
        return <CustomFallback isLoading={true} />;
      }
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Memeriksa akses {featureName}...
            </p>
          </div>
        </div>
      );
    }

    // Error state
    if (tokenStatus.error) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-sm p-6">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-gray-600 mb-4">
              Gagal memeriksa status langganan.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      );
    }

    // Render wrapped component if has access
    if (tokenStatus.hasAccess) {
      return (
        <>
          <WrappedComponent {...props} />
          {/* Pass token info to children via context if needed */}
          {props.children}
        </>
      );
    }

    // No access state - Modal will show
    return (
      <>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-sm p-6">
            <div className="text-4xl mb-3">🔒</div>
            <p className="text-gray-600 mb-2">
              Akses {featureName} Terbatas
            </p>
            <p className="text-sm text-gray-400">
              {tokenStatus.reason === "no_session" &&
                "Silakan login untuk melanjutkan."}
              {tokenStatus.reason === "expired" &&
                "Masa langganan Anda telah berakhir."}
              {tokenStatus.reason === "no_tokens" &&
                "Token Anda tidak mencukupi."}
              {tokenStatus.reason === "locked" &&
                "Akun Anda terkunci. Hubungi admin."}
            </p>
          </div>
        </div>

        <TokenHabisModal
          open={showErrorModal}
          shortfall={requiredTokens}
          currentAddon={0}
          onClose={() => setShowErrorModal(false)}
          onBuyTopUp={() => {}}
          onUpgrade={() => router.push("/pricing")}
        />
      </>
    );
  }

  TokenGuardedComponent.displayName = `withTokenGuard(${WrappedComponent.displayName || WrappedComponent.name})`;

  return TokenGuardedComponent;
}

/**
 * Hook version for more granular control
 */
export { useTokenError } from "@/app/hooks/useTokenError";
