"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Notification {
  id: string;
  type: "transaction" | "payout" | "subscription";
  alert_type: string;
  status?: string;
  amount: number;
  email: string;
  nama_lengkap: string;
  whatsapp?: string;
  external_id?: string;
  created_at: string;
  updated_at?: string;
  priority: "high" | "medium" | "low";
  isNew: boolean;
  status_langganan?: string; // untuk subscription type
}

interface NotificationCounts {
  pendingTransactions: number;
  pendingPayouts: number;
  expiringSubscriptions: number;
  total: number;
}

interface NotificationBellProps {
  onNotificationClick?: (notification: Notification) => void;
  onBadgeClick?: () => void;
}

// Sound URLs - using free notification sounds
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVw5UJ3b6bZkPkyU1Orz5I1mXITU6vPkjW5dhNPq9OSNb1+E0+r05I1vX4TT6vTkjW9ghNPq9OSNb2CE0+r05I1vYITT6vTkjW9hhNPq9OSNb2GE0+r05I1vYoTT6vTkjW9jhNPq9OSNb2OE0+r05I1vZITS6vTkjW9lhNLq9OSNb2aE0+r05I1vZoTS6vTkjW9nhNLq9OSNb2iE0ur05I1vaYTS6vTkjW9qhNLq9OSNb2uE0ur05I1va4TS6vTkjW9shNLq9OSNb2yE0ur05I1vbYTS6vTkjW9uhNLq9OSNb2+E0ur05I1vb4TS6vTkjW9whNLq9OSNb3CE0ur05I1vcYTS6vTkjW9yhNLq9OSNb3OE0ur05I1vc4TS6vTkjW90hNLq9OSNb3SE0ur05I1vdYTS6vTkjW92hNLq9OSNb3eE0ur05I1veIT" +
                             "S6vTkjW94hNLq9OSNb3mE0ur05I1veoTS6vTkjW97hNLq9OSNb3yE0ur05I1vfYTS6vTkjW9+hNLq9OSNb3+E0ur05I1vf4TS6vTkjW9yhNLq9OSNb32E0ur05I1vf4TS6vTkjX+U0ur05I1/lNLq9OSNf5jS6vTkjX+a0ur05I1/mtLq9OSNf5zS6vTkjX+fUur05I1/oNLq9OSNf6HS6vTkjX+k0ur05I1/pdLq9OSNf6bS6vTkjX+nUur05I1/qNLq9OSNf6nS6vTkjX+rUur05I1/q9Lq9OSNf6zS6vTkjX+t0ur05I1/rdLq9OSNf63S6vTkjX+u0ur05I1/rtLq9OSNf7DS6vTkjX+00ur05I1/sdLq9OSNf7LS6vTkjX+z0ur05I1/tNLq9OSNf7XS6vTkjX+20ur05I1/ttLq9OSNf7jS6vTkjX+60ur05I1/utLq9OSNf7zS6vTkjX++0ur05I1/vtLq9OSNf8DS6vTkjX/A0ur05I1/wdLq9OSNf8LS6vTkjX/D0ur05I1/xNLq9OSNf8XS6vTkjX/G0ur05I1/xtLq9OSNf8jS6vTkjX/K0ur05I1/ytLq9OSNf8zS6vTkjX/O0ur05I1/ztLq9OSNf9DS6vTkjX/Q0ur05I1/0dLq9OSNf9LS6vTkjX/T0ur05I1/1NLq9OSNf9XS6vTkjX/a0ur05I1/2tLq9OSNf9zS6vTkjX/e0ur05I1/3tLq9OSNf+DS6vTkjX/g0ur05I1/4dLq9OSNf+LS6vTkjX/k0ur05I1/5dLq9OSNf+nS6vTkjX/r0ur05I1/7dLq9OSNf+7S6vTkjX/v0ur05I1/8NLq9OSNf/DS6vTkjX/y0ur05I1/9dLq9OSNf/fS6vTkjX/40ur05I1/+dLq9OSN";

export default function NotificationBell({ onNotificationClick, onBadgeClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({
    pendingTransactions: 0,
    pendingPayouts: 0,
    expiringSubscriptions: 0,
    total: 0
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCountsRef = useRef<NotificationCounts | null>(null);

  // Initialize audio
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio(NOTIFICATION_SOUND);
      audioRef.current.volume = 0.5;
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Ignore autoplay restrictions
      });
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (isPolling = false) => {
    try {
      const url = lastTimestamp
        ? `/api/admin/notifications?limit=20&since=${encodeURIComponent(lastTimestamp)}`
        : "/api/admin/notifications?limit=20";

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();

        // Check for new notifications
        if (isPolling && previousCountsRef.current) {
          const newPendingTx = data.counts.pendingTransactions - previousCountsRef.current.pendingTransactions;
          const newPendingPayouts = data.counts.pendingPayouts - previousCountsRef.current.pendingPayouts;

          if (newPendingTx > 0 || newPendingPayouts > 0) {
            setHasNewNotifications(true);
            playNotificationSound();
          }
        }

        previousCountsRef.current = counts;
        setCounts(data.counts);
        setLastTimestamp(data.timestamp);

        if (!isPolling || notifications.length === 0) {
          setNotifications(data.notifications || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, [lastTimestamp, counts, notifications.length, playNotificationSound]);

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications(false);

    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark as read when opening dropdown
  const handleOpenDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewNotifications(false);
      onBadgeClick?.();
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return date.toLocaleDateString("id-ID");
  };

  // Get notification icon
  const getNotificationIcon = (notification: Notification) => {
    if (notification.type === "payout") return "💸";
    if (notification.type === "subscription") return "⏰";
    if (notification.status === "PAID") return "✅";
    if (notification.status === "PENDING") return "⏳";
    return "📋";
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    if (priority === "high") return "border-l-rose-500";
    if (priority === "medium") return "border-l-amber-500";
    return "border-l-slate-300";
  };

  // Get notification message
  const getNotificationMessage = (notification: Notification) => {
    if (notification.type === "payout") {
      return `Permintaan pencairan ${formatCurrency(notification.amount)}`;
    }
    if (notification.type === "subscription") {
      return `Langganan akan berakhir: ${notification.status_langganan}`;
    }
    if (notification.status === "PAID") {
      return `Pembayaran berhasil ${formatCurrency(notification.amount)}`;
    }
    return `Transaksi baru ${formatCurrency(notification.amount)}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpenDropdown}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
      >
        <svg
          className={`w-6 h-6 ${counts.total > 0 ? "text-slate-700" : "text-slate-400"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {counts.total > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-black rounded-full text-white ${
            hasNewNotifications ? "bg-rose-500 animate-pulse" : "bg-indigo-600"
          }`}>
            {counts.total > 99 ? "99+" : counts.total}
          </span>
        )}

        {/* New indicator dot */}
        {hasNewNotifications && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-200 z-50">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Notifikasi</h3>
              <div className="flex items-center gap-2">
                {hasNewNotifications && (
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                    BARU!
                  </span>
                )}
                <button
                  onClick={() => fetchNotifications(false)}
                  className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                  disabled={isLoading}
                >
                  <svg
                    className={`w-4 h-4 text-slate-500 ${isLoading ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-2 mt-3">
              <div className="flex-1 text-center p-2 bg-white rounded-xl border border-slate-200">
                <p className="text-lg font-black text-indigo-600">{counts.pendingTransactions}</p>
                <p className="text-[9px] text-slate-500 font-medium">Transaksi</p>
              </div>
              <div className="flex-1 text-center p-2 bg-white rounded-xl border border-slate-200">
                <p className="text-lg font-black text-emerald-600">{counts.pendingPayouts}</p>
                <p className="text-[9px] text-slate-500 font-medium">Payout</p>
              </div>
              <div className="flex-1 text-center p-2 bg-white rounded-xl border border-slate-200">
                <p className="text-lg font-black text-amber-600">{counts.expiringSubscriptions}</p>
                <p className="text-[9px] text-slate-500 font-medium">Exp Soon</p>
              </div>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[350px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <span className="text-4xl mb-3 block">🔔</span>
                <p className="text-slate-500 text-sm font-medium">Tidak ada notifikasi</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => {
                      onNotificationClick?.(notification);
                      setIsOpen(false);
                    }}
                    className={`w-full p-4 text-left hover:bg-slate-50 transition-colors border-l-4 ${getPriorityColor(notification.priority)} ${
                      notification.isNew ? "bg-rose-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{getNotificationIcon(notification)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {notification.nama_lengkap || "Pengguna"}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {getNotificationMessage(notification)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">
                          {formatTime(notification.updated_at || notification.created_at)}
                        </p>
                      </div>
                      {notification.isNew && (
                        <span className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => {
                  setNotifications([]);
                  setHasNewNotifications(false);
                }}
                className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Tandai semua sudah dibaca
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
