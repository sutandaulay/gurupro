"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import CmsLandingEditor from "@/components/admin/CmsLandingEditor";
import TransactionsManager from "@/components/admin/TransactionsManager";
import AdminManager from "@/components/admin/AdminManager";
import SchoolRegistrationsManager from "@/components/admin/SchoolRegistrationsManager";
import InstitutionsManager from "@/components/admin/InstitutionsManager";
import NotificationBell from "@/components/admin/NotificationBell";
import { ToastProvider, useToast } from "@/components/admin/ToastNotification";

function AdminPageContent() {
  const [activeTab, setActiveTab] = useState<"users" | "transactions" | "cms" | "registrations" | "institutions" | "referrals" | "admins" | "settings" | "notifications">("users");
  
  // Data States
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // CMS States (managed by CmsLandingEditor component)

  // Referrals State
  const [referralsList, setReferralsList] = useState<any[]>([]);
  const [payoutRequestsList, setPayoutRequestsList] = useState<any[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(true);
  const [isLoadingPayouts, setIsLoadingPayouts] = useState(true);
  const [isProcessingPayout, setIsProcessingPayout] = useState<{ [key: string]: boolean }>({});
  const [isProcessingAdminPayout, setIsProcessingAdminPayout] = useState<{ [key: string]: boolean }>({});

  // CMS Configurable limits (managed by CmsLandingEditor)

  // System Settings States
  const [pgConfig, setPgConfig] = useState<any>(null);
  const [emailConfig, setEmailConfig] = useState<any>(null);
  const [waConfig, setWaConfig] = useState<any>(null);
  const [templates, setTemplates] = useState<any>(null);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [pricingConfig, setPricingConfig] = useState<any>(null);
  const [appBrandingConfig, setAppBrandingConfig] = useState<any>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<"register" | "forgot_password" | "payment_success" | "payout_approved" | "payout_rejected">("register");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [testAiLoading, setTestAiLoading] = useState(false);

  // Test notification states
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testWaNumber, setTestWaNumber] = useState("");
  const [testWaLoading, setTestWaLoading] = useState(false);

  // Loading & Error States
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search States
  const [userSearch, setUserSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");

  // Edit User States
  const [editingUserId, setEditingUserId] = useState<any>(null);
  const [editUsername, setEditUsername] = useState<string>("");
  const [editTokenLimit, setEditTokenLimit] = useState<number>(0);
  const [editRole, setEditRole] = useState<string>("guru");
  const [editSubStart, setEditSubStart] = useState<string>("");
  const [editSubEnd, setEditSubEnd] = useState<string>("");
  const [editSubStatus, setEditSubStatus] = useState<string>("free");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editNewPassword, setEditNewPassword] = useState<string>("");
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Refund State
  const [isRefunding, setIsRefunding] = useState<{ [key: string]: boolean }>({});

  const [adminNotifications, setAdminNotifications] = useState({
    pendingPayouts: 0,
    pendingTransactions: 0,
    totalNotifications: 0
  });

  // Notification Broadcast States
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [notificationTarget, setNotificationTarget] = useState<"single" | "all" | "free_users" | "premium_users">("all");
  const [notificationTargetEmail, setNotificationTargetEmail] = useState("");
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState<Array<{ title: string; body: string; sentCount: number; timestamp: Date }>>([]);

  // Toast hook
  const { addToast } = useToast();

  // Ref untuk tracking notifikasi baru
  const previousPendingTxRef = useRef(0);
  const previousPendingPayoutsRef = useRef(0);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Handle notification click
  const handleNotificationClick = useCallback((notification: any) => {
    if (notification.type === "transaction" || notification.status) {
      setActiveTab("transactions");
      setTxSearch(notification.external_id || notification.id);
    } else if (notification.type === "payout") {
      setActiveTab("referrals");
    }
  }, []);

  // Handle sending notification to users
  const handleSendNotification = async () => {
    if (!notificationTitle || !notificationBody) {
      addToast({
        type: "error",
        title: "Gagal",
        message: "Judul dan isi pesan wajib diisi",
        duration: 4000,
        icon: "❌"
      });
      return;
    }

    if (notificationTarget === "single" && !notificationTargetEmail) {
      addToast({
        type: "error",
        title: "Gagal",
        message: "Email atau username wajib diisi untuk pengiriman single user",
        duration: 4000,
        icon: "❌"
      });
      return;
    }

    setIsSendingNotification(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_notification",
          title: notificationTitle,
          body: notificationBody,
          targetType: notificationTarget,
          targetEmail: notificationTarget === "single" ? notificationTargetEmail : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addToast({
          type: "success",
          title: "Berhasil!",
          message: `Notifikasi berhasil dikirim ke ${data.sentCount} pengguna`,
          duration: 5000,
          icon: "✅"
        });

        // Add to broadcast history
        setBroadcastHistory(prev => [{
          title: notificationTitle,
          body: notificationBody,
          sentCount: data.sentCount,
          timestamp: new Date(),
        }, ...prev.slice(0, 9)]);

        // Reset form
        setNotificationTitle("");
        setNotificationBody("");
        setNotificationTargetEmail("");
      } else {
        addToast({
          type: "error",
          title: "Gagal",
          message: data.error || "Gagal mengirim notifikasi",
          duration: 4000,
          icon: "❌"
        });
      }
    } catch (err) {
      console.error("Send notification error:", err);
      addToast({
        type: "error",
        title: "Error",
        message: "Terjadi kesalahan saat mengirim notifikasi",
        duration: 4000,
        icon: "❌"
      });
    } finally {
      setIsSendingNotification(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTransactions();
    fetchReferralsList();
    fetchPayoutRequestsList();
    fetchSettings();
  }, []);

  const pollingCancelled = useRef(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      const controller = new AbortController();
      try {
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch("/api/admin/notifications?limit=5", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const newPendingTx = data.counts?.pendingTransactions || 0;
          const newPendingPayouts = data.counts?.pendingPayouts || 0;

          // Deteksi pembayaran baru
          if (newPendingTx > previousPendingTxRef.current) {
            const newPayments = newPendingTx - previousPendingTxRef.current;
            // Ambil detail transaksi terbaru untuk toast
            if (data.notifications && data.notifications.length > 0) {
              const latestTx = data.notifications.find((n: any) => n.status === "PAID" || n.status === "PENDING");
              if (latestTx) {
                addToast({
                  type: "payment",
                  title: "💳 Pembayaran Baru!",
                  message: `${latestTx.nama_lengkap || "User"} - Rp ${formatCurrency(latestTx.amount)}`,
                  duration: 6000,
                  icon: latestTx.status === "PAID" ? "✅" : "⏳"
                });
              }
            } else if (newPayments > 0) {
              addToast({
                type: "payment",
                title: `📋 ${newPayments} Transaksi Baru`,
                message: `Ada ${newPayments} pembayaran baru yang menunggu diproses`,
                duration: 5000,
                icon: "💳"
              });
            }
          }

          // Deteksi payout request baru
          if (newPendingPayouts > previousPendingPayoutsRef.current) {
            const newPayouts = newPendingPayouts - previousPendingPayoutsRef.current;
            addToast({
              type: "warning",
              title: "💸 Request Payout Baru!",
              message: `Ada ${newPayouts} permintaan pencairan saldo baru`,
              duration: 6000,
              icon: "💸"
            });
          }

          previousPendingTxRef.current = newPendingTx;
          previousPendingPayoutsRef.current = newPendingPayouts;
          setAdminNotifications(data.counts || {
            pendingPayouts: newPendingPayouts,
            pendingTransactions: newPendingTx,
            totalNotifications: newPendingTx + newPendingPayouts
          });
        }
      } catch {
        // silent
      }
    };

    fetchNotifications();
    const interval = setInterval(() => {
      if (!pollingCancelled.current) fetchNotifications();
    }, 15000); // Poll every 15 seconds
    return () => {
      pollingCancelled.current = true;
      clearInterval(interval);
    };
  }, [addToast, formatCurrency]);

  const fetchUsers = async (queryStr = "") => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(queryStr)}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        let errMsg = "Gagal memuat daftar pengguna";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        setErrorMsg(errMsg);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Koneksi gagal saat memuat daftar pengguna");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchTransactions = async (queryStr = "") => {
    setIsLoadingTx(true);
    try {
      const res = await fetch(`/api/admin/transactions?q=${encodeURIComponent(queryStr)}&includeStats=true`);
      if (res.ok) {
        const data = await res.json();
        // Support both old format (array) and new format (object with transactions key)
        const txList = Array.isArray(data) ? data : (data.transactions || []);
        setTransactions(txList);
      } else {
        let errMsg = "Gagal memuat transaksi";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        setErrorMsg(errMsg);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Koneksi gagal saat memuat data transaksi");
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleSearchUsers = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(userSearch);
  };

  const handleSearchTx = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions(txSearch);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    signOut({ callbackUrl: "/login" });
  };

  const startEditUser = (user: any) => {
    setEditingUserId(user.id);
    setEditUsername(user.username || "");
    setEditTokenLimit(user.token_limit || 0);
    setEditRole(user.role || "guru");
    setEditSubStatus(user.status_langganan || "free");
    setEditIsActive(user.is_active !== false);
    setEditNewPassword("");
    const fmtDate = (dStr: string) => {
      if (!dStr) return "";
      try {
        return new Date(dStr).toISOString().substring(0, 10);
      } catch {
        return "";
      }
    };
    setEditSubStart(fmtDate(user.subscription_start));
    setEditSubEnd(fmtDate(user.subscription_end));
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
  };

  const saveUserConfig = async (userId: any) => {
    setIsSavingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId, 
          username: editUsername || null,
          token_limit: editTokenLimit, 
          role: editRole,
          subscription_start: editSubStart || null,
          subscription_end: editSubEnd || null,
          status_langganan: editSubStatus,
          is_active: editIsActive,
          new_password: editNewPassword || null
        }),
      });
      if (res.ok) {
        setSuccessMsg("Pengaturan user berhasil diperbarui!");
        setEditingUserId(null);
        fetchUsers(userSearch);
      } else {
        let errMsg = "Gagal memperbarui pengaturan user";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        setErrorMsg(errMsg);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Gagal menghubungi server untuk update user");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleRefund = async (txId: string) => {
    if (!confirm("Apakah Anda yakin ingin melakukan refund transaksi ini? Kuota token pengguna akan dipotong, status langganan disetel ke free, dan status transaksi berubah menjadi REFUNDED.")) {
      return;
    }

    setIsRefunding((prev) => ({ ...prev, [txId]: true }));
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId, action: "refund" }),
      });
      if (res.ok) {
        setSuccessMsg("Refund berhasil diproses!");
        fetchTransactions(txSearch);
        fetchUsers(userSearch);
      } else {
        let errMsg = "Gagal memproses refund";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        setErrorMsg(errMsg);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Koneksi bermasalah saat memproses refund");
    } finally {
      setIsRefunding((prev) => ({ ...prev, [txId]: false }));
    }
  };

  const handleActivateTransaction = async (txId: string) => {
    if (!confirm("Apakah Anda yakin ingin memverifikasi dan mengaktifkan paket untuk transaksi ini? Kuota token pengguna akan ditambahkan, status langganan diaktifkan, dan status transaksi berubah menjadi ACTIVATED.")) {
      return;
    }

    setIsRefunding((prev) => ({ ...prev, [txId]: true }));
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId, action: "activate" }),
      });
      if (res.ok) {
        setSuccessMsg("Paket berhasil diaktifkan!");
        fetchTransactions(txSearch);
        fetchUsers(userSearch);
      } else {
        let errMsg = "Gagal mengaktifkan paket";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        setErrorMsg(errMsg);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Koneksi bermasalah saat mengaktifkan paket");
    } finally {
      setIsRefunding((prev) => ({ ...prev, [txId]: false }));
    }
  };

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setPgConfig(data.paymentGateway);
        setEmailConfig(data.emailSender);
        setWaConfig(data.waSender);
        setTemplates(data.templates);
        setAiConfig(data.aiConfig);
        setPricingConfig(data.pricingConfig);
        setAppBrandingConfig(data.appBranding);
      }
    } catch (e) {
      console.error("Gagal memuat pengaturan sistem:", e);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran berkas logo maksimal 2MB!");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const target = event.target;
      if (target && target.result) {
        setAppBrandingConfig((prev: any) => ({
          ...prev,
          app_logo: target.result as string
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSetting = async (action: string, data: any) => {
    setIsSavingSettings(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data })
      });
      let resData: any = {};
      try {
        resData = await res.json();
      } catch {}
      if (res.ok) {
        setSuccessMsg(resData.message || "Pengaturan berhasil diperbarui!");
        fetchSettings(); // Refresh settings state
      } else {
        setErrorMsg(resData.error || "Gagal memperbarui pengaturan");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Koneksi gagal saat memperbarui pengaturan");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      setErrorMsg("Email tujuan tes wajib diisi!");
      return;
    }
    setTestEmailLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_email",
          data: { to: testEmailAddress }
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok) {
        setSuccessMsg(data.message);
      } else {
        setErrorMsg(data.error || "Gagal mengirim email tes");
      }
    } catch (e) {
      setErrorMsg("Koneksi gagal saat melakukan tes email");
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleTestWA = async () => {
    if (!testWaNumber) {
      setErrorMsg("Nomor WA tujuan tes wajib diisi!");
      return;
    }
    setTestWaLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_wa",
          data: { to: testWaNumber }
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok) {
        setSuccessMsg(data.message);
      } else {
        setErrorMsg(data.error || "Gagal mengirim WhatsApp tes");
      }
    } catch (e) {
      setErrorMsg("Koneksi gagal saat melakukan tes WA");
    } finally {
      setTestWaLoading(false);
    }
  };

  const handleTestAI = async () => {
    setTestAiLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_ai",
          data: {}
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok) {
        setSuccessMsg(data.message);
      } else {
        setErrorMsg(data.error || "Gagal memanggil API AI");
      }
    } catch (e) {
      setErrorMsg("Koneksi gagal saat melakukan tes AI");
    } finally {
      setTestAiLoading(false);
    }
  };

  const fetchReferralsList = async () => {
    setIsLoadingReferrals(true);
    try {
      const res = await fetch("/api/admin/referrals");
      if (res.ok) {
        const data = await res.json();
        setReferralsList(data);
      }
    } catch (e) {
      console.error("Gagal memuat referrals:", e);
    } finally {
      setIsLoadingReferrals(false);
    }
  };

  const handleProcessPayout = async (email: string, balance: number) => {
    if (balance <= 0) return;
    if (!confirm(`Apakah Anda yakin ingin memproses pencairan cashback sebesar Rp ${balance.toLocaleString("id-ID")} untuk user ${email}? Saldo cashback user akan disetel kembali ke 0.`)) {
      return;
    }

    setIsProcessingPayout((prev) => ({ ...prev, [email]: true }));
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSuccessMsg(`Pencairan saldo Rp ${balance.toLocaleString("id-ID")} berhasil diproses!`);
        fetchReferralsList();
        fetchUsers();
      } else {
        let errMsg = "Gagal memproses pencairan";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        setErrorMsg(errMsg);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Koneksi gagal saat memproses pencairan");
    } finally {
      setIsProcessingPayout((prev) => ({ ...prev, [email]: false }));
    }
  };

  const fetchPayoutRequestsList = async () => {
    setIsLoadingPayouts(true);
    try {
      const res = await fetch("/api/admin/referrals/payouts");
      if (res.ok) {
        const data = await res.json();
        setPayoutRequestsList(data);
      }
    } catch (e) {
      console.error("Gagal memuat requests pencairan:", e);
    } finally {
      setIsLoadingPayouts(false);
    }
  };

  const handleProcessAdminPayout = async (requestId: string, status: "APPROVED" | "REJECTED", userEmail: string, amount: number) => {
    const actionText = status === "APPROVED" ? "menyetujui" : "menolak";
    if (!confirm(`Apakah Anda yakin ingin ${actionText} pencairan saldo sebesar Rp ${amount.toLocaleString("id-ID")} untuk ${userEmail}?`)) {
      return;
    }

    setIsProcessingAdminPayout((prev) => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch("/api/admin/referrals/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      if (res.ok) {
        setSuccessMsg(`Permintaan pencairan berhasil di-${status.toLowerCase()}!`);
        fetchPayoutRequestsList();
        fetchReferralsList();
        fetchUsers();
      } else {
        let errMsg = "Gagal memproses tindakan pencairan";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        setErrorMsg(errMsg);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Koneksi gagal saat menghubungi server");
    } finally {
      setIsProcessingAdminPayout((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  // Toast auto-clear
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // Calculations for Metrics
  const totalUsers = users.length;
  const transactionsList = Array.isArray(transactions) ? transactions : [];
  const paidTransactions = transactionsList.filter((t) => t.status === "PAID");
  const totalPaidTxCount = paidTransactions.length;
  const grossRevenue = paidTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0);

  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6">
      
      {/* Toast Notifications */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-xl animate-bounce">
          ✅ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-6 right-6 z-50 bg-rose-600 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-xl animate-pulse">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Admin Navbar */}
      <header className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-lg font-black shadow-md">
            🛡️
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight">Admin Hub GuruPRO</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">SaaS Management Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <NotificationBell
            onNotificationClick={handleNotificationClick}
            onBadgeClick={() => {
              if (activeTab !== "transactions" && activeTab !== "referrals") {
                setActiveTab("transactions");
              }
            }}
          />

          <a
            href="/dashboard"
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-2xl transition cursor-pointer"
          >
            Buka Dashboard Guru
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl transition cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Dashboard Stats Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
          <span className="text-xs font-bold block uppercase tracking-wider text-indigo-100">Total Pengguna Terdaftar</span>
          <span className="text-3xl font-black block mt-2">{totalUsers} Guru</span>
          <span className="text-[10px] text-indigo-100 mt-2 block font-medium">Berdasarkan hasil pencarian / data terisi</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
          <span className="text-xs font-bold block uppercase tracking-wider text-emerald-100">Total Transaksi Sukses</span>
          <span className="text-3xl font-black block mt-2">{totalPaidTxCount} Transaksi</span>
          <span className="text-[10px] text-emerald-100 mt-2 block font-medium">Transaksi berstatus PAID dari invoice Xendit</span>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
          <span className="text-xs font-bold block uppercase tracking-wider text-purple-100">Total Pendapatan Kotor</span>
          <span className="text-3xl font-black block mt-2">{formatter.format(grossRevenue)}</span>
          <span className="text-[10px] text-purple-100 mt-2 block font-medium">Akumulasi pembayaran yang berhasil masuk</span>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Navigation Sidebar/Top tabs */}
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full gap-1 whitespace-nowrap scrollbar-thin">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === "users" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              👤 Kelola Pengguna
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "transactions" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>💳 Riwayat Transaksi</span>
              {adminNotifications.pendingTransactions > 0 && (
                <span className="bg-rose-500 text-white font-extrabold rounded-full px-1.5 py-0.5 text-[9px] animate-pulse">
                  {adminNotifications.pendingTransactions}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("cms")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === "cms" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🌐 CMS Landing Page
            </button>
            <button
              onClick={() => setActiveTab("registrations")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === "registrations" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📋 Pendaftaran Sekolah
            </button>
            <button
              onClick={() => setActiveTab("institutions")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === "institutions" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🏫 Kelola Lembaga
            </button>

            <button
              onClick={() => setActiveTab("referrals")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === "referrals" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🎁 Kelola Referral</span>
              {adminNotifications.pendingPayouts > 0 && (
                <span className="bg-rose-500 text-white font-extrabold rounded-full px-1.5 py-0.5 text-[9px] animate-pulse">
                  {adminNotifications.pendingPayouts}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("admins")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === "admins" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              👥 Kelola Admin
            </button>

            <button
              onClick={() => { setActiveTab("settings"); fetchSettings(); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === "settings" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ⚙️ Integrasi Sistem
            </button>

            <button
              onClick={() => setActiveTab("notifications")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === "notifications" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🔔 Kirim Notifikasi
            </button>
          </div>

          {/* Search Inputs */}
          {activeTab === "users" ? (
            <form onSubmit={handleSearchUsers} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari username, email, nama, whatsapp..."
                className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium text-slate-800 w-full sm:w-60"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cari
              </button>
            </form>
          ) : activeTab === "transactions" ? (
            <form onSubmit={handleSearchTx} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Cari ID transaksi, email..."
                className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium text-slate-800 w-full sm:w-60"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cari
              </button>
            </form>
          ) : (
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {activeTab === "cms" ? "Landing Page Editor" : "Referral & Cashback Payout Center"}
            </div>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-6 flex-1">
          {activeTab === "users" ? (
            <div className="overflow-x-auto">
              {isLoadingUsers ? (
                <div className="text-center py-20 text-slate-400 font-semibold">Memuat daftar pengguna...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-20 text-slate-400 italic">Tidak ada data pengguna ditemukan.</div>
              ) : (
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5">Nama & Sekolah</th>
                      <th className="px-5 py-3.5">Username, Email & WA</th>
                      <th className="px-5 py-3.5 text-center">Langganan</th>
                      <th className="px-5 py-3.5">Masa Berlangganan</th>
                      <th className="px-5 py-3.5 text-center">Peran</th>
                      <th className="px-5 py-3.5 text-right">Kuota Token</th>
                      <th className="px-5 py-3.5 text-center">Kelola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {users.map((user) => {
                      const isEditing = editingUserId === user.id;
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-800 text-xs">{user.nama_lengkap || "(Belum Mengisi Nama)"}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{user.nama_sekolah || "(Belum Mengisi Sekolah)"}</p>
                          </td>
                          <td className="px-5 py-4">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 w-44">
                                <label className="text-[9px] text-slate-400 font-bold uppercase">Username</label>
                                <input
                                  type="text"
                                  value={editUsername}
                                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                                  placeholder="username"
                                  className="px-2 py-0.5 border border-slate-200 rounded text-[10px] font-bold outline-none bg-white text-slate-800"
                                />
                                <p className="text-[10px] text-slate-500 font-semibold">{user.email}</p>
                              </div>
                            ) : (
                              <>
                                <p className="text-slate-800 font-bold">@{user.username || "-"}</p>
                                <p className="text-slate-700 font-semibold">{user.email}</p>
                              </>
                            )}
                            <p className="text-[10px] text-slate-400 font-mono">+{user.whatsapp}</p>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col gap-1 items-center justify-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                user.status_langganan && user.status_langganan !== 'free'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                  : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}>
                                {user.status_langganan === 'three_month' ? '🏆 PRO 3 BULAN' : 
                                 user.status_langganan === 'six_month' ? '🏆 PRO 6 BULAN' : 
                                 user.status_langganan === 'one_year' ? '🏆 PRO 1 TAHUN' : 
                                 user.status_langganan === 'pro' ? '🏆 PRO' : '⚡ FREE'}
                              </span>
                              {user.is_active === false ? (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 border border-rose-200 text-rose-800 text-[8px] font-extrabold uppercase">🚫 Nonaktif</span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-800 text-[8px] font-extrabold uppercase">✓ Aktif</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 w-32">
                                <label className="text-[9px] text-slate-400 font-bold uppercase">Paket</label>
                                <select
                                  value={editSubStatus}
                                  onChange={(e) => setEditSubStatus(e.target.value)}
                                  className="px-1.5 py-0.5 border border-slate-200 rounded text-[10px] outline-none font-bold bg-white text-slate-800 mb-1"
                                >
                                  <option value="free">FREE</option>
                                  <option value="three_month">3 Bulan</option>
                                  <option value="six_month">6 Bulan</option>
                                  <option value="one_year">1 Tahun</option>
                                </select>
                                <label className="text-[9px] text-slate-400 font-bold uppercase">Mulai</label>
                                <input
                                  type="date"
                                  value={editSubStart}
                                  onChange={(e) => setEditSubStart(e.target.value)}
                                  className="px-1.5 py-0.5 border border-slate-200 rounded text-[10px] outline-none font-bold bg-white text-slate-800"
                                />
                                <label className="text-[9px] text-slate-400 font-bold uppercase">Berakhir</label>
                                <input
                                  type="date"
                                  value={editSubEnd}
                                  onChange={(e) => setEditSubEnd(e.target.value)}
                                  className="px-1.5 py-0.5 border border-slate-200 rounded text-[10px] outline-none font-bold bg-white text-slate-800"
                                />
                              </div>
                            ) : (
                              <div className="text-[10px] space-y-0.5 font-semibold text-slate-700">
                                {user.subscription_start || user.subscription_end ? (
                                  <>
                                    <p><span className="text-slate-400">Mulai:</span> {user.subscription_start ? new Date(user.subscription_start).toLocaleDateString("id-ID") : "-"}</p>
                                    <p><span className="text-slate-400">Hingga:</span> {user.subscription_end ? new Date(user.subscription_end).toLocaleDateString("id-ID") : "-"}</p>
                                    {user.status_langganan && user.status_langganan !== 'free' && user.subscription_end && (() => {
                                      const daysLeft = (new Date(user.subscription_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
                                      if (daysLeft < 0) {
                                        return <span className="inline-block px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[8px] font-black uppercase mt-1">❌ Kedaluwarsa</span>;
                                      } else if (daysLeft <= 7) {
                                        return <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[8px] font-black uppercase mt-1">⏳ Berakhir Segera</span>;
                                      } else {
                                        return <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[8px] font-black uppercase mt-1">✓ Aktif</span>;
                                      }
                                    })()}
                                  </>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Tidak ada info</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 w-24">
                                <label className="text-[9px] text-slate-400 font-bold uppercase text-left">Peran</label>
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value)}
                                  className="px-1.5 py-0.5 border border-slate-200 bg-white rounded text-[10px] font-bold outline-none"
                                >
                                  <option value="guru">Guru</option>
                                  <option value="operator">Operator</option>
                                  <option value="kepala_sekolah">Kepala Sekolah</option>
                                  <option value="pengawas">Pengawas</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <label className="text-[9px] text-slate-400 font-bold uppercase text-left mt-1">Status</label>
                                <select
                                  value={editIsActive ? "active" : "inactive"}
                                  onChange={(e) => setEditIsActive(e.target.value === "active")}
                                  className="px-1.5 py-0.5 border border-slate-200 bg-white rounded text-[10px] font-bold outline-none"
                                >
                                  <option value="active">Aktif</option>
                                  <option value="inactive">Nonaktif</option>
                                </select>
                              </div>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                user.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {(user.role || 'guru').replace("_", " ").toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 items-end">
                                <label className="text-[9px] text-slate-400 font-bold uppercase">Token</label>
                                <input
                                  type="number"
                                  value={editTokenLimit}
                                  onChange={(e) => setEditTokenLimit(parseInt(e.target.value) || 0)}
                                  className="px-2 py-0.5 border border-slate-200 rounded text-right text-[10px] font-bold outline-none w-20 bg-white"
                                />
                                <label className="text-[9px] text-slate-400 font-bold uppercase mt-1">Reset Sandi</label>
                                <input
                                  type="password"
                                  placeholder="Sandi baru"
                                  value={editNewPassword}
                                  onChange={(e) => setEditNewPassword(e.target.value)}
                                  className="px-2 py-0.5 border border-slate-200 rounded text-[10px] font-bold outline-none w-24 bg-white"
                                />
                              </div>
                            ) : (
                              <span className="font-bold text-slate-800 text-xs">{user.token_limit || 0} Token</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => saveUserConfig(user.id)}
                                  disabled={isSavingUser}
                                  className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded text-[10px] hover:bg-indigo-700 transition"
                                >
                                  {isSavingUser ? "..." : "Simpan"}
                                </button>
                                <button
                                  onClick={cancelEditUser}
                                  className="px-2 py-1 bg-white border border-slate-200 text-slate-500 font-bold rounded text-[10px] hover:bg-slate-100 transition"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditUser(user)}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                              >
                                Edit Akun
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : activeTab === "transactions" ? (
            <TransactionsManager
              onSuccess={(msg) => setSuccessMsg(msg)}
              onError={(msg) => setErrorMsg(msg)}
            />
          ) : activeTab === "cms" ? (
            <CmsLandingEditor />
          ) : activeTab === "registrations" ? (
            <div className="p-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h2 className="text-lg font-black text-slate-800">📋 Manajemen Pendaftaran Sekolah</h2>
                <p className="text-xs text-slate-400 mt-1">Kelola pendaftaran sekolah/lembaga yang masuk melalui formulir publik.</p>
              </div>
              <SchoolRegistrationsManager />
            </div>
          ) : activeTab === "institutions" ? (
            <div className="p-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h2 className="text-lg font-black text-slate-800">🏫 Kelola Lembaga</h2>
                <p className="text-xs text-slate-400 mt-1">Kelola data seluruh institusi/sekolah, tingkat langganan (tier), dan status aktif.</p>
              </div>
              <InstitutionsManager />
            </div>
          ) : activeTab === "referrals" ? (
            <div className="space-y-8">
              {/* Metrics cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 border border-indigo-100 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Total Terdaftar Lewat Referral</span>
                  <span className="text-3xl font-black text-slate-800 block mt-2">{referralsList.length} Guru</span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Pengguna yang memasukkan kode referral saat pendaftaran</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 border border-emerald-100 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Total Potensi Komisi Cashback</span>
                  <span className="text-3xl font-black text-slate-800 block mt-2">
                    {formatter.format(referralsList.reduce((acc, curr) => acc + (curr.cashback_amount || 0), 0))}
                  </span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Akumulasi komisi yang diberikan oleh sistem kepada referrer</p>
                </div>
              </div>

              {/* Payout Requests Section */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2.5 uppercase tracking-wider">
                  <span>💸</span> Permintaan Pencairan Saldo (Payout Requests)
                </h3>

                <div className="overflow-x-auto">
                  {isLoadingPayouts ? (
                    <div className="text-center py-8 text-slate-400 font-semibold text-xs">Memuat data permintaan pencairan...</div>
                  ) : payoutRequestsList.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 italic text-xs">Belum ada permintaan pencairan saldo diajukan.</div>
                  ) : (
                    <table className="w-full text-xs text-left text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[9px]">
                        <tr>
                          <th className="px-4 py-2.5">Tanggal</th>
                          <th className="px-4 py-2.5">Nama &amp; Email Guru</th>
                          <th className="px-4 py-2.5">Rekening Tujuan</th>
                          <th className="px-4 py-2.5">Catatan Pengajuan</th>
                          <th className="px-4 py-2.5 text-right">Jumlah</th>
                          <th className="px-4 py-2.5 text-center">Status</th>
                          <th className="px-4 py-2.5 text-center">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {payoutRequestsList.map((req) => (
                          <tr key={req.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono text-[10px]">
                              {new Date(req.created_at).toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800 text-xs">{req.user_name || "(Tidak Ada Nama)"}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">{req.user_email}</p>
                              <p className="text-[9px] text-slate-400 font-mono">📞 +{req.user_wa}</p>
                            </td>
                            <td className="px-4 py-3">
                              {req.bank_name ? (
                                <div className="text-[10px]">
                                  <p className="font-bold text-slate-800 uppercase">{req.bank_name}</p>
                                  <p className="font-mono text-indigo-600 font-bold">{req.bank_account_number}</p>
                                  <p className="text-slate-400 font-semibold mt-0.5">a/n {req.bank_account_name}</p>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">Tidak Diisi</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium text-[10px]">
                              {req.catatan || "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-800">
                              {formatter.format(req.jumlah)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black border ${
                                req.status === "APPROVED"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : req.status === "PENDING"
                                  ? "bg-amber-50 border-amber-200 text-amber-700 animate-pulse"
                                  : "bg-rose-50 border-rose-200 text-rose-700"
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {req.status === "PENDING" ? (
                                <div className="flex justify-center gap-1.5">
                                  <button
                                    onClick={() => handleProcessAdminPayout(req.id, "APPROVED", req.user_email, req.jumlah)}
                                    disabled={isProcessingAdminPayout[req.id]}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] transition cursor-pointer"
                                  >
                                    Setujui
                                  </button>
                                  <button
                                    onClick={() => handleProcessAdminPayout(req.id, "REJECTED", req.user_email, req.jumlah)}
                                    disabled={isProcessingAdminPayout[req.id]}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] transition cursor-pointer"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-bold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">Selesai</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Referrals Ledger Table */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2.5 uppercase tracking-wider">
                  <span>👥</span> Riwayat Pendaftaran Mitra &amp; Konversi Referral
                </h3>
                <div className="overflow-x-auto">
                  {isLoadingReferrals ? (
                    <div className="text-center py-20 text-slate-400 font-semibold">Memuat riwayat referral...</div>
                  ) : referralsList.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 italic">Belum ada riwayat pendaftaran menggunakan referral.</div>
                  ) : (
                    <table className="w-full text-xs text-left text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-5 py-3.5">Tanggal</th>
                          <th className="px-5 py-3.5">Pengundang (Referrer)</th>
                          <th className="px-5 py-3.5">Pendaftar (Referee)</th>
                          <th className="px-5 py-3.5 text-center">Hadiah Token</th>
                          <th className="px-5 py-3.5 text-right">Cashback</th>
                          <th className="px-5 py-3.5 text-right font-bold text-emerald-700">Saldo Dompet Referrer</th>
                          <th className="px-5 py-3.5 text-center">Aksi Langsung</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {referralsList.map((ref) => (
                          <tr key={ref.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-4 whitespace-nowrap text-slate-400 font-mono text-[10px]">
                              {new Date(ref.created_at).toLocaleString("id-ID")}
                            </td>
                            <td className="px-5 py-4">
                              <p className="font-bold text-slate-800 text-xs">{ref.referrer_name || "(Tidak Ada Nama)"}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">{ref.referrer_email}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">📞 +{ref.referrer_wa}</p>
                            </td>
                            <td className="px-5 py-4">
                              <p className="font-bold text-slate-800 text-xs">{ref.referee_name || "(Tidak Ada Nama)"}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">{ref.referee_email}</p>
                            </td>
                            <td className="px-5 py-4 text-center font-bold text-indigo-600">
                              +{ref.reward_tokens} Tokens
                            </td>
                            <td className="px-5 py-4 text-right font-semibold text-slate-700">
                              {formatter.format(ref.cashback_amount)}
                            </td>
                            <td className="px-5 py-4 text-right font-black text-emerald-600">
                              {formatter.format(ref.referrer_balance)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {ref.referrer_balance > 0 ? (
                                <button
                                  onClick={() => handleProcessPayout(ref.referrer_email, ref.referrer_balance)}
                                  disabled={isProcessingPayout[ref.referrer_email]}
                                  className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                                >
                                  {isProcessingPayout[ref.referrer_email] ? "Memproses..." : "Cairkan Saldo"}
                                </button>
                              ) : (
                                <span className="text-[9px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl uppercase">Selesai / Rp0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "admins" ? (
            <div className="animate-fadeIn">
              <AdminManager
                onSuccess={(msg) => setSuccessMsg(msg)}
                onError={(msg) => setErrorMsg(msg)}
              />
            </div>
          ) : activeTab === "notifications" ? (
            <div className="animate-fadeIn">
              {/* Notification Sender Panel */}
              <div className="p-6 space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-black text-slate-800 font-sans">🔔 Kirim Notifikasi ke Pengguna</h2>
                  <p className="text-xs text-slate-400 mt-1">Kirim notifikasi ke Bell pengguna secara manual - untuk pengumuman atau informasi penting.</p>
                </div>

                {/* Quick Templates */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                    <span>📋</span> Template Cepat
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "🎉 Promo Berlangganan", title: "Diskon 20%!", body: "Dapatkan diskon 20% untuk paket tahunan. Promo terbatas!" },
                      { label: "📢 Maintenance", title: "Pemeliharaan Sistem", body: "Akan ada pemeliharaan sistem pada tanggal..." },
                      { label: "💎 Token Bonus", title: "Bonus Token Gratis!", body: "Klaim bonus token gratis untuk aktivitas tertentu!" },
                      { label: "📚 Tips & Trick", title: "Tips Menggunakan GuruPRO", body: "Berikut tips untuk memaksimalkan penggunaan platform..." },
                    ].map((template, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setNotificationTitle(template.title);
                          setNotificationBody(template.body);
                        }}
                        className="p-3 border border-slate-200 rounded-xl text-xs text-left hover:border-indigo-300 hover:bg-indigo-50 transition cursor-pointer"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Send Notification Form */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                    <span>✉️</span> Form Kirim Notifikasi
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Judul Notifikasi</label>
                      <input
                        type="text"
                        value={notificationTitle}
                        onChange={(e) => setNotificationTitle(e.target.value)}
                        placeholder="Contoh: Promo Spesial!"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Isi Pesan</label>
                      <textarea
                        value={notificationBody}
                        onChange={(e) => setNotificationBody(e.target.value)}
                        placeholder="Tulis pesan notifikasi di sini..."
                        rows={4}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Pengiriman</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { value: "single", label: "👤 Satu User", icon: "single" },
                          { value: "all", label: "👥 Semua User", icon: "all" },
                          { value: "free_users", label: "🆓 User Gratis", icon: "free" },
                          { value: "premium_users", label: "💎 User Premium", icon: "premium" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setNotificationTarget(option.value)}
                            className={`p-3 border rounded-xl text-xs text-center transition cursor-pointer ${
                              notificationTarget === option.value
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                : "border-slate-200 hover:border-slate-300 text-slate-600"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {notificationTarget === "single" && (
                      <div className="animate-fadeIn">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Email atau Username User</label>
                        <input
                          type="text"
                          value={notificationTargetEmail}
                          onChange={(e) => setNotificationTargetEmail(e.target.value)}
                          placeholder="user@email.com atau username"
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400">
                        Notifikasi akan muncul di Bell (🔔) pengguna yang dituju.
                      </p>
                      <button
                        onClick={handleSendNotification}
                        disabled={isSendingNotification || !notificationTitle || !notificationBody}
                        className={`px-6 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSendingNotification || !notificationTitle || !notificationBody
                            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                      >
                        {isSendingNotification ? "Mengirim..." : "📤 Kirim Notifikasi"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Broadcasts */}
                {broadcastHistory.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                      <span>📜</span> Riwayat Broadcast Terakhir
                    </h3>
                    <div className="space-y-2">
                      {broadcastHistory.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                          <div>
                            <p className="font-bold text-slate-800">{item.title}</p>
                            <p className="text-slate-500">{item.body}</p>
                          </div>
                          <span className="text-slate-400">{item.sentCount} user</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-8 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 font-sans">⚙️ Integrasi Sistem &amp; Manajemen Notifikasi</h2>
                <p className="text-xs text-slate-400 mt-1">Konfigurasikan gerbang pembayaran, layanan pengiriman email SMTP, WhatsApp gateway, serta template pesan otomatis.</p>
              </div>

              {isLoadingSettings ? (
                <div className="text-center py-12 text-slate-400 font-semibold text-xs">Memuat konfigurasi integrasi sistem...</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* LEFT COLUMN: PAYMENTS & CHANNELS */}
                  <div className="space-y-6">
                    {/* A. PAYMENT GATEWAY SETTINGS */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <span>💳</span> Konfigurasi Payment Gateway
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Gateway Aktif (Default)</label>
                          <select
                            value={pgConfig?.default_gateway || "mock"}
                            onChange={(e: any) => setPgConfig({ ...pgConfig, default_gateway: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="mock">Offline / Simulasi Mock Checkout</option>
                            <option value="xendit">Xendit (QRIS, E-Wallet, VA)</option>
                            <option value="midtrans">Midtrans Snap (QRIS, VA, CC, Kartu Debit)</option>
                            <option value="duitku">Duitku (Virtual Account, QRIS, Retail Store)</option>
                          </select>
                        </div>

                        {/* Xendit Config Fields */}
                        {pgConfig?.default_gateway === "xendit" && (
                          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-3 animate-fadeIn">
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Kredensial Xendit</span>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Secret API Key (Secret Key)</label>
                              <input
                                type="password"
                                value={pgConfig?.xendit?.api_key || ""}
                                onChange={(e) => setPgConfig({
                                  ...pgConfig,
                                  xendit: { ...pgConfig.xendit, api_key: e.target.value }
                                })}
                                placeholder="xnd_development_..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                id="xendit_sandbox"
                                checked={!!pgConfig?.xendit?.is_sandbox}
                                onChange={(e) => setPgConfig({
                                  ...pgConfig,
                                  xendit: { ...pgConfig.xendit, is_sandbox: e.target.checked }
                                })}
                                className="w-3.5 h-3.5 border-slate-300 rounded text-indigo-600"
                              />
                              <label htmlFor="xendit_sandbox" className="text-[10px] text-slate-600 font-semibold cursor-pointer">Mode Sandbox / Uji Coba</label>
                            </div>
                          </div>
                        )}

                        {/* Midtrans Config Fields */}
                        {pgConfig?.default_gateway === "midtrans" && (
                          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-3 animate-fadeIn">
                            <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full uppercase">Kredensial Midtrans</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block mb-1">Merchant ID</label>
                                <input
                                  type="text"
                                  value={pgConfig?.midtrans?.merchant_id || ""}
                                  onChange={(e) => setPgConfig({
                                    ...pgConfig,
                                    midtrans: { ...pgConfig.midtrans, merchant_id: e.target.value }
                                  })}
                                  placeholder="G123456789"
                                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block mb-1">Client Key</label>
                                <input
                                  type="text"
                                  value={pgConfig?.midtrans?.client_key || ""}
                                  onChange={(e) => setPgConfig({
                                    ...pgConfig,
                                    midtrans: { ...pgConfig.midtrans, client_key: e.target.value }
                                  })}
                                  placeholder="SB-Mid-client-..."
                                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Server Key</label>
                              <input
                                type="password"
                                value={pgConfig?.midtrans?.server_key || ""}
                                onChange={(e) => setPgConfig({
                                  ...pgConfig,
                                  midtrans: { ...pgConfig.midtrans, server_key: e.target.value }
                                })}
                                placeholder="SB-Mid-server-..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                id="midtrans_sandbox"
                                checked={!!pgConfig?.midtrans?.is_sandbox}
                                onChange={(e) => setPgConfig({
                                  ...pgConfig,
                                  midtrans: { ...pgConfig.midtrans, is_sandbox: e.target.checked }
                                })}
                                className="w-3.5 h-3.5 border-slate-300 rounded text-indigo-600"
                              />
                              <label htmlFor="midtrans_sandbox" className="text-[10px] text-slate-600 font-semibold cursor-pointer">Mode Sandbox / Uji Coba</label>
                            </div>
                          </div>
                        )}

                        {/* Duitku Config Fields */}
                        {pgConfig?.default_gateway === "duitku" && (
                          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-3 animate-fadeIn">
                            <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase">Kredensial Duitku</span>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Merchant Code</label>
                              <input
                                type="text"
                                value={pgConfig?.duitku?.merchant_code || ""}
                                onChange={(e) => setPgConfig({
                                  ...pgConfig,
                                  duitku: { ...pgConfig.duitku, merchant_code: e.target.value }
                                })}
                                placeholder="D12345"
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">API Key (Merchant Key)</label>
                              <input
                                type="password"
                                value={pgConfig?.duitku?.api_key || ""}
                                onChange={(e) => setPgConfig({
                                  ...pgConfig,
                                  duitku: { ...pgConfig.duitku, api_key: e.target.value }
                                })}
                                placeholder="6812abc..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                id="duitku_sandbox"
                                checked={!!pgConfig?.duitku?.is_sandbox}
                                onChange={(e) => setPgConfig({
                                  ...pgConfig,
                                  duitku: { ...pgConfig.duitku, is_sandbox: e.target.checked }
                                })}
                                className="w-3.5 h-3.5 border-slate-300 rounded text-indigo-600"
                              />
                              <label htmlFor="duitku_sandbox" className="text-[10px] text-slate-600 font-semibold cursor-pointer">Mode Sandbox / Uji Coba</label>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => handleSaveSetting("update_payment_gateway", pgConfig)}
                            disabled={isSavingSettings}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Simpan Payment Gateway
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* B. EMAIL SENDER CONFIGURATION */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                          <span>📧</span> Pengirim Email (SMTP)
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!emailConfig?.active}
                            onChange={(e) => setEmailConfig({ ...emailConfig, active: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                          <span className="ml-2 text-[10px] font-bold text-slate-500 uppercase">{emailConfig?.active ? "Aktif" : "Nonaktif"}</span>
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="text-[9px] font-bold text-slate-500 block mb-1">SMTP Host</label>
                            <input
                              type="text"
                              value={emailConfig?.smtp?.host || ""}
                              onChange={(e) => setEmailConfig({
                                ...emailConfig,
                                smtp: { ...emailConfig.smtp, host: e.target.value }
                              })}
                              placeholder="smtp.mailtrap.io"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1">Port</label>
                            <input
                              type="number"
                              value={emailConfig?.smtp?.port || ""}
                              onChange={(e) => setEmailConfig({
                                ...emailConfig,
                                smtp: { ...emailConfig.smtp, port: Number(e.target.value) }
                              })}
                              placeholder="587"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1">SMTP Username</label>
                            <input
                              type="text"
                              value={emailConfig?.smtp?.user || ""}
                              onChange={(e) => setEmailConfig({
                                ...emailConfig,
                                smtp: { ...emailConfig.smtp, user: e.target.value }
                              })}
                              placeholder="postmaster@..."
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1">SMTP Password</label>
                            <input
                              type="password"
                              value={emailConfig?.smtp?.pass || ""}
                              onChange={(e) => setEmailConfig({
                                ...emailConfig,
                                smtp: { ...emailConfig.smtp, pass: e.target.value }
                              })}
                              placeholder="••••••••"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1">Nama Pengirim (Display)</label>
                            <input
                              type="text"
                              value={emailConfig?.sender_name || ""}
                              onChange={(e) => setEmailConfig({ ...emailConfig, sender_name: e.target.value })}
                              placeholder="GuruPRO Support"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1">Alamat Email Pengirim</label>
                            <input
                              type="email"
                              value={emailConfig?.sender_email || ""}
                              onChange={(e) => setEmailConfig({ ...emailConfig, sender_email: e.target.value })}
                              placeholder="support@gurupro.id"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="email_secure"
                              checked={!!emailConfig?.smtp?.secure}
                              onChange={(e) => setEmailConfig({
                                ...emailConfig,
                                smtp: { ...emailConfig.smtp, secure: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 border-slate-300 rounded text-indigo-600"
                            />
                            <label htmlFor="email_secure" className="text-[10px] text-slate-600 font-semibold cursor-pointer">Gunakan SSL/TLS (Secure)</label>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveSetting("update_email_sender", emailConfig)}
                            disabled={isSavingSettings}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Simpan Email SMTP
                          </button>
                        </div>

                        {/* Email Testing section */}
                        <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 mt-2 space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Tes Pengiriman Email</label>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={testEmailAddress}
                              onChange={(e) => setTestEmailAddress(e.target.value)}
                              placeholder="Kirim tes ke email..."
                              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={handleTestEmail}
                              disabled={testEmailLoading || !testEmailAddress}
                              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                            >
                              {testEmailLoading ? "Mengirim..." : "Kirim Tes"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* E. AI API VENDOR CONFIGURATION */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 animate-fadeIn">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <span>🧠</span> Konfigurasi Vendor AI / LLM
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vendor AI Utama (Default)</label>
                          <select
                            value={aiConfig?.default_vendor || "mock"}
                            onChange={(e: any) => setAiConfig({ ...aiConfig, default_vendor: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="mock">Offline / Simulasi Mock AI (Hemat Kuota)</option>
                            <option value="gemini">Google Gemini AI</option>
                            <option value="openai">OpenAI ChatGPT</option>
                            <option value="claude">Anthropic Claude</option>
                            <option value="deepseek">DeepSeek AI</option>
                          </select>
                        </div>

                        {/* Gemini AI Config Fields */}
                        {aiConfig?.default_vendor === "gemini" && (
                          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-3 animate-fadeIn">
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Google Gemini</span>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Gemini API Key</label>
                              <input
                                type="password"
                                value={aiConfig?.gemini?.api_key || ""}
                                onChange={(e) => setAiConfig({
                                  ...aiConfig,
                                  gemini: { ...aiConfig.gemini, api_key: e.target.value }
                                })}
                                placeholder="AIzaSy..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Model Name</label>
                              <input
                                type="text"
                                value={aiConfig?.gemini?.model_name || ""}
                                onChange={(e) => setAiConfig({
                                  ...aiConfig,
                                  gemini: { ...aiConfig.gemini, model_name: e.target.value }
                                })}
                                placeholder="gemini-2.5-flash atau gemini-2.5-pro"
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* OpenAI Config Fields */}
                        {aiConfig?.default_vendor === "openai" && (
                          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-3 animate-fadeIn">
                            <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full uppercase">OpenAI ChatGPT</span>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">OpenAI API Key</label>
                              <input
                                type="password"
                                value={aiConfig?.openai?.api_key || ""}
                                onChange={(e) => setAiConfig({
                                  ...aiConfig,
                                  openai: { ...aiConfig.openai, api_key: e.target.value }
                                })}
                                placeholder="sk-..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Model Name</label>
                              <input
                                type="text"
                                value={aiConfig?.openai?.model_name || ""}
                                onChange={(e) => setAiConfig({
                                  ...aiConfig,
                                  openai: { ...aiConfig.openai, model_name: e.target.value }
                                })}
                                placeholder="gpt-4o-mini atau gpt-4o"
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* Claude Config Fields */}
                        {aiConfig?.default_vendor === "claude" && (
                          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-3 animate-fadeIn">
                            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase">Anthropic Claude</span>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Claude API Key</label>
                              <input
                                type="password"
                                value={aiConfig?.claude?.api_key || ""}
                                onChange={(e) => setAiConfig({
                                  ...aiConfig,
                                  claude: { ...aiConfig.claude, api_key: e.target.value }
                                })}
                                placeholder="sk-ant-..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Model Name</label>
                              <input
                                type="text"
                                value={aiConfig?.claude?.model_name || ""}
                                onChange={(e) => setAiConfig({
                                  ...aiConfig,
                                  claude: { ...aiConfig.claude, model_name: e.target.value }
                                })}
                                placeholder="claude-3-5-sonnet-20241022"
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* DeepSeek Config Fields */}
                        {aiConfig?.default_vendor === "deepseek" && (
                          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-3 animate-fadeIn">
                            <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase">DeepSeek AI</span>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">DeepSeek API Key</label>
                              <input
                                type="password"
                                value={aiConfig?.deepseek?.api_key || ""}
                                onChange={(e) => setAiConfig({
                                  ...aiConfig,
                                  deepseek: { ...aiConfig.deepseek, api_key: e.target.value }
                                })}
                                placeholder="sk-..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Model Name</label>
                              <input
                                type="text"
                                value={aiConfig?.deepseek?.model_name || ""}
                                onChange={(e) => setAiConfig({
                                  ...aiConfig,
                                  deepseek: { ...aiConfig.deepseek, model_name: e.target.value }
                                })}
                                placeholder="deepseek-chat"
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          {aiConfig?.default_vendor !== "mock" ? (
                            <button
                              type="button"
                              onClick={handleTestAI}
                              disabled={testAiLoading}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                            >
                              {testAiLoading ? "Menghubungi AI..." : "⚡ Uji Koneksi AI"}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold italic">Uji koneksi dinonaktifkan dalam mode Simulasi</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSaveSetting("update_ai_config", aiConfig)}
                            disabled={isSavingSettings}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Simpan Pengaturan AI
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: WHATSAPP & TEMPLATES */}
                  <div className="space-y-6">
                    {/* C. WHATSAPP SENDER CONFIGURATION */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                          <span>💬</span> Pengirim WhatsApp Gateway
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!waConfig?.active}
                            onChange={(e) => setWaConfig({ ...waConfig, active: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                          <span className="ml-2 text-[10px] font-bold text-slate-500 uppercase">{waConfig?.active ? "Aktif" : "Nonaktif"}</span>
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Provider WhatsApp</label>
                          <select
                            value={waConfig?.provider || "fonnte"}
                            onChange={(e) => setWaConfig({ ...waConfig, provider: e.target.value })}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="fonnte">Fonnte (fonnte.com)</option>
                            <option value="ruangwa">RuangWA (ruangwa.co)</option>
                          </select>
                        </div>

                        {/* Fonnte Fields */}
                        {waConfig?.provider === "fonnte" && (
                          <div className="space-y-3 bg-emerald-50/30 border border-emerald-100/50 rounded-2xl p-4 animate-fadeIn">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Fonnte App Token</label>
                              <input
                                type="password"
                                value={waConfig?.fonnte?.token || ""}
                                onChange={(e) => setWaConfig({
                                  ...waConfig,
                                  fonnte: { ...waConfig.fonnte, token: e.target.value }
                                })}
                                placeholder="Masukkan token API Fonnte..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Nomor Pengirim (Terdaftar Fonnte)</label>
                              <input
                                type="text"
                                value={waConfig?.fonnte?.sender_number || ""}
                                onChange={(e) => setWaConfig({
                                  ...waConfig,
                                  fonnte: { ...waConfig.fonnte, sender_number: e.target.value }
                                })}
                                placeholder="Contoh: 081234567890"
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* RuangWA Fields */}
                        {waConfig?.provider === "ruangwa" && (
                          <div className="space-y-3 bg-emerald-50/30 border border-emerald-100/50 rounded-2xl p-4 animate-fadeIn">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">RuangWA API Token</label>
                              <input
                                type="password"
                                value={waConfig?.ruangwa?.token || ""}
                                onChange={(e) => setWaConfig({
                                  ...waConfig,
                                  ruangwa: { ...waConfig.ruangwa, token: e.target.value }
                                })}
                                placeholder="Masukkan token RuangWA..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Nomor WA Pengirim (Device)</label>
                              <input
                                type="text"
                                value={waConfig?.ruangwa?.sender_number || ""}
                                onChange={(e) => setWaConfig({
                                  ...waConfig,
                                  ruangwa: { ...waConfig.ruangwa, sender_number: e.target.value }
                                })}
                                placeholder="Contoh: 081234567890"
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveSetting("update_wa_sender", waConfig)}
                            disabled={isSavingSettings}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Simpan WhatsApp Config
                          </button>
                        </div>

                        {/* WA Testing section */}
                        <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 mt-2 space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Tes Pengiriman WhatsApp</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={testWaNumber}
                              onChange={(e) => setTestWaNumber(e.target.value)}
                              placeholder="Nomor WA (Contoh: 0812345xx)..."
                              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={handleTestWA}
                              disabled={testWaLoading || !testWaNumber}
                              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                            >
                              {testWaLoading ? "Mengirim..." : "Kirim Tes"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* D. NOTIFICATION TEMPLATE EDITOR */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <span><span>📝</span></span> Kustomisasi Template Notifikasi
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pilih Acara / Trigger Event</label>
                          <select
                            value={selectedTemplateKey}
                            onChange={(e: any) => setSelectedTemplateKey(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="register">Daftar Akun Baru (Register)</option>
                            <option value="forgot_password">Kode OTP Lupa Password</option>
                            <option value="payment_success">Pembayaran PRO Sukses</option>
                            <option value="payout_approved">Pencairan Cashback Disetujui</option>
                            <option value="payout_rejected">Pencairan Cashback Ditolak</option>
                          </select>
                        </div>

                        {templates && templates[selectedTemplateKey] && (
                          <div className="space-y-4 border border-slate-100 rounded-2xl p-4 bg-slate-50/30 animate-fadeIn">
                            <div className="flex gap-4 border-b border-slate-100 pb-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!templates[selectedTemplateKey].email_enabled}
                                  onChange={(e) => {
                                    const updated = { ...templates };
                                    updated[selectedTemplateKey].email_enabled = e.target.checked;
                                    setTemplates(updated);
                                  }}
                                  className="w-3.5 h-3.5 border-slate-300 rounded text-indigo-600"
                                />
                                <span className="text-[10px] font-bold text-slate-600">Kirim Notifikasi Email</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!templates[selectedTemplateKey].wa_enabled}
                                  onChange={(e) => {
                                    const updated = { ...templates };
                                    updated[selectedTemplateKey].wa_enabled = e.target.checked;
                                    setTemplates(updated);
                                  }}
                                  className="w-3.5 h-3.5 border-slate-300 rounded text-indigo-600"
                                />
                                <span className="text-[10px] font-bold text-slate-600">Kirim Notifikasi WhatsApp</span>
                              </label>
                            </div>

                            {/* Email Template Details */}
                            {templates[selectedTemplateKey].email_enabled && (
                              <div className="space-y-3 animate-fadeIn">
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-1">Subjek Email</label>
                                  <input
                                    type="text"
                                    value={templates[selectedTemplateKey].email_subject || ""}
                                    onChange={(e) => {
                                      const updated = { ...templates };
                                      updated[selectedTemplateKey].email_subject = e.target.value;
                                      setTemplates(updated);
                                    }}
                                    placeholder="Subjek email..."
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-1">Body Email (Format HTML)</label>
                                  <textarea
                                    value={templates[selectedTemplateKey].email_body || ""}
                                    onChange={(e) => {
                                      const updated = { ...templates };
                                      updated[selectedTemplateKey].email_body = e.target.value;
                                      setTemplates(updated);
                                    }}
                                    rows={5}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                              </div>
                            )}

                            {/* WA Template Details */}
                            {templates[selectedTemplateKey].wa_enabled && (
                              <div className="space-y-2 pt-2 border-t border-slate-100/60 animate-fadeIn">
                                <label className="text-[9px] font-bold text-slate-500 block mb-1">Isi Pesan WhatsApp</label>
                                <textarea
                                  value={templates[selectedTemplateKey].wa_message || ""}
                                  onChange={(e) => {
                                    const updated = { ...templates };
                                    updated[selectedTemplateKey].wa_message = e.target.value;
                                    setTemplates(updated);
                                  }}
                                  rows={4}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            )}

                            {/* Variable Legend */}
                            <div className="bg-slate-100 border border-slate-200/50 rounded-xl p-3 text-[10px] text-slate-500 font-medium space-y-1">
                              <span className="font-bold text-slate-600 block mb-0.5 uppercase tracking-wide text-[9px]">Variabel yang Tersedia:</span>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                <div><code className="text-indigo-600 font-bold font-mono">{`{nama_lengkap}`}</code> : Nama Guru</div>
                                <div><code className="text-indigo-600 font-bold font-mono">{`{email}`}</code> : Email Guru</div>
                                {selectedTemplateKey === "register" && <div><code className="text-indigo-600 font-bold font-mono">{`{referral_code}`}</code> : Kode Referral</div>}
                                {selectedTemplateKey === "forgot_password" && <div><code className="text-indigo-600 font-bold font-mono">{`{otp_code}`}</code> : Kode OTP 6-Digit</div>}
                                {(selectedTemplateKey === "payout_approved" || selectedTemplateKey === "payout_rejected") && (
                                  <>
                                    <div><code className="text-indigo-600 font-bold font-mono">{`{amount}`}</code> : Jumlah Pencairan</div>
                                    <div><code className="text-indigo-600 font-bold font-mono">{`{bank_name}`}</code> : Nama Bank</div>
                                    <div><code className="text-indigo-600 font-bold font-mono">{`{bank_account_number}`}</code> : No Rekening</div>
                                    <div><code className="text-indigo-600 font-bold font-mono">{`{bank_account_name}`}</code> : a/n Pemilik</div>
                                    {selectedTemplateKey === "payout_rejected" && <div><code className="text-indigo-600 font-bold font-mono">{`{catatan}`}</code> : Alasan Penolakan</div>}
                                  </>
                                )}
                                {selectedTemplateKey === "payment_success" && (
                                  <>
                                    <div><code className="text-indigo-600 font-bold font-mono">{`{amount}`}</code> : Total Bayar</div>
                                    <div><code className="text-indigo-600 font-bold font-mono">{`{plan_name}`}</code> : Nama Paket PRO</div>
                                    <div><code className="text-indigo-600 font-bold font-mono">{`{payment_method}`}</code> : Metode Bayar</div>
                                    <div><code className="text-indigo-600 font-bold font-mono">{`{tokens_added}`}</code> : Bonus Token</div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveSetting("update_templates", templates)}
                            disabled={isSavingSettings}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Simpan Perubahan Template
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* D. APP BRANDING PROFILE CONFIGURATION */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <span>🏷️</span> Branding Profil Aplikasi (SaaS)
                      </h3>

                      <div className="space-y-4 font-sans text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nama Aplikasi</label>
                          <input
                            type="text"
                            value={appBrandingConfig?.app_name || ""}
                            onChange={(e) => setAppBrandingConfig({ ...appBrandingConfig, app_name: e.target.value })}
                            placeholder="GuruPRO"
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Aksen Warna Tema (Hex Code)</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={appBrandingConfig?.accent_color || "#4f46e5"}
                              onChange={(e) => setAppBrandingConfig({ ...appBrandingConfig, accent_color: e.target.value })}
                              className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={appBrandingConfig?.accent_color || ""}
                              onChange={(e) => setAppBrandingConfig({ ...appBrandingConfig, accent_color: e.target.value })}
                              placeholder="#4f46e5"
                              className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Kontak Support</label>
                          <input
                            type="email"
                            value={appBrandingConfig?.contact_email || ""}
                            onChange={(e) => setAppBrandingConfig({ ...appBrandingConfig, contact_email: e.target.value })}
                            placeholder="support@gurupro.id"
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">WhatsApp Kontak Support</label>
                          <input
                            type="text"
                            value={appBrandingConfig?.contact_whatsapp || ""}
                            onChange={(e) => setAppBrandingConfig({ ...appBrandingConfig, contact_whatsapp: e.target.value })}
                            placeholder="628123456789"
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Logo Aplikasi (Upload / base64)</label>
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="w-full text-xs font-bold text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                            />
                            <div className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider text-center">Atau Paste URL / Base64</div>
                            <input
                              type="text"
                              value={appBrandingConfig?.app_logo || ""}
                              onChange={(e) => setAppBrandingConfig({ ...appBrandingConfig, app_logo: e.target.value })}
                              placeholder="data:image/png;base64,..."
                              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none font-mono"
                            />
                          </div>
                          {appBrandingConfig?.app_logo && (
                            <div className="mt-2 p-2 border border-slate-100 rounded-2xl bg-slate-50 flex items-center justify-center">
                              <img src={appBrandingConfig.app_logo} alt="Branding Logo Preview" className="max-h-12 object-contain" />
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => handleSaveSetting("update_app_branding", appBrandingConfig)}
                            disabled={isSavingSettings}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Simpan Profil Branding
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper with ToastProvider
export default function AdminPage() {
  return (
    <ToastProvider>
      <AdminPageContent />
    </ToastProvider>
  );
}
