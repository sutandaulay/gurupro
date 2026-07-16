"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info" | "payment";
  title: string;
  message: string;
  duration?: number;
  icon?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Sound for payment notifications
const PAYMENT_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVw5UJ3b6bZkPkyU1Orz5I1mXITU6vPkjW5dhNPq9OSNb1+E0+r05I1vX4TT6vTkjW9ghNPq9OSNb2CE0+r05I1vYITT6vTkjW9hhNPq9OSNb2GE0+r05I1vYoTT6vTkjW9jhNPq9OSNb2OE0+r05I1vZITS6vTkjW9lhNLq9OSNb2aE0+r05I1vZoTS6vTkjW9nhNLq9OSNb2iE0ur05I1vaYTS6vTkjW9qhNLq9OSNb2uE0ur05I1va4TS6vTkjW9shNLq9OSNb2yE0ur05I1vbYTS6vTkjW9uhNLq9OSNb2+E0ur05I1vb4TS6vTkjW9whNPq9OSNb3CE0ur05I1vcYTS6vTkjW9yhNPq9OSNb3OE0ur05I1vc4TS6vTkjX/U0ur05I1/1NLq9OSNf9jS6vTkjX/Z0ur05I1/2tLq9OSNf9zS6vTkjX/e0ur05I1/3tLq9OSNf+DS6vTkjX/g0ur05I1/4dLq9OSNf+LS6vTkjX/k0ur05I1/5dLq9OSNf+nS6vTkjX/r0ur05I1/7dLq9OSNf+7S6vTkjX/v0ur05I1/8NLq9OSNf/DS6vTkjX/y0ur05I1/9dLq9OSNf/fS6vTkjX/40ur05I1/+dLq9OSN";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAudioRef(new Audio(PAYMENT_SOUND));
    }
  }, []);

  const playSound = useCallback((type: Toast["type"]) => {
    if (type === "payment" && audioRef) {
      audioRef.currentTime = 0;
      audioRef.play().catch(() => {});
    }
  }, [audioRef]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    playSound(toast.type);

    setToasts((prev) => [...prev, { ...toast, id }]);
  }, [playSound]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300);

    const removeTimer = setTimeout(() => {
      onRemove();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.duration, onRemove]);

  const getToastStyles = () => {
    switch (toast.type) {
      case "success":
        return "bg-emerald-600 text-white border-emerald-700";
      case "error":
        return "bg-rose-600 text-white border-rose-700";
      case "warning":
        return "bg-amber-500 text-white border-amber-600";
      case "payment":
        return "bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-700";
      default:
        return "bg-slate-800 text-white border-slate-900";
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "payment":
        return "💳";
      default:
        return "ℹ";
    }
  };

  return (
    <div
      className={`${getToastStyles()} rounded-2xl shadow-2xl border p-4 transform transition-all duration-300 ${
        isExiting
          ? "translate-x-full opacity-0 scale-95"
          : "translate-x-0 opacity-100 scale-100"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${
          toast.type === "success" ? "bg-emerald-700" :
          toast.type === "error" ? "bg-rose-700" :
          toast.type === "warning" ? "bg-amber-600" :
          toast.type === "payment" ? "bg-indigo-700" :
          "bg-slate-700"
        }`}>
          {toast.icon || getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{toast.title}</p>
          <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>

          {/* Action button */}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(onRemove, 300);
          }}
          className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 rounded-b-2xl overflow-hidden">
        <div
          className={`h-full bg-white/40 rounded-full ${
            toast.type === "success" ? "animate-progress-success" :
            toast.type === "error" ? "animate-progress-error" :
            toast.type === "payment" ? "animate-progress-payment" :
            "animate-progress"
          }`}
          style={{
            animation: `shrink ${toast.duration || 5000}ms linear forwards`
          }}
        />
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes progress {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// Hook for triggering payment notifications
export function usePaymentNotifications() {
  const { addToast } = useToast();
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

  const notifyPaymentReceived = useCallback((
    userName: string,
    amount: number,
    planName: string,
    transactionId: string
  ) => {
    if (transactionId === lastPaymentId) return;
    setLastPaymentId(transactionId);

    addToast({
      type: "payment",
      title: "💳 Pembayaran Baru!",
      message: `${userName} - ${planName} - Rp ${amount.toLocaleString("id-ID")}`,
      duration: 8000,
      action: {
        label: "Lihat Detail",
        onClick: () => {
          window.location.href = `/admin?tab=transactions&highlight=${transactionId}`;
        }
      }
    });
  }, [addToast, lastPaymentId]);

  return { notifyPaymentReceived };
}
