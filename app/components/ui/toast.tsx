"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  IconCircleCheck,
  IconX,
  IconAlertTriangle,
  IconInfoCircle,
} from "@tabler/icons-react";

/* ─── Types ─── */

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: {
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
  };
}

/* ─── Context ─── */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx.toast;
}

/* ─── Config ─── */

const variantConfig: Record<
  ToastVariant,
  {
    icon: React.ComponentType<{ size?: number; stroke?: number; className?: string }>;
    containerClass: string;
    iconClass: string;
  }
> = {
  success: {
    icon: IconCircleCheck,
    containerClass: "border-green-200 bg-green-50",
    iconClass: "text-green-500",
  },
  error: {
    icon: IconX,
    containerClass: "border-red-200 bg-red-50",
    iconClass: "text-red-500",
  },
  warning: {
    icon: IconAlertTriangle,
    containerClass: "border-amber-200 bg-amber-50",
    iconClass: "text-amber-500",
  },
  info: {
    icon: IconInfoCircle,
    containerClass: "border-blue-200 bg-blue-50",
    iconClass: "text-blue-500",
  },
};

/* ─── Individual Toast ─── */

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const config = variantConfig[toast.variant];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 p-4 border rounded-xl shadow-dropdown bg-white min-w-[320px] max-w-[420px] animate-slide-in`}
    >
      <Icon size={22} stroke={1.5} className={`flex-shrink-0 ${config.iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-gray-500 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        <IconX size={16} stroke={1.5} />
      </button>
    </div>
  );
}

/* ─── Provider ─── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((prev) => {
        const next = [...prev, { id, variant, title, message }];
        return next.slice(-3);
      });
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (title: string, message?: string) =>
      addToast("success", title, message),
    error: (title: string, message?: string) =>
      addToast("error", title, message),
    warning: (title: string, message?: string) =>
      addToast("warning", title, message),
    info: (title: string, message?: string) =>
      addToast("info", title, message),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
