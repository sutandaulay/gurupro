"use client";

import { useState, useEffect, useCallback } from "react";
import FollowUpModal from "./FollowUpModal";
import TransactionDetailModal from "./TransactionDetailModal";

interface Transaction {
  id: string;
  user_id: string;
  external_id: string;
  amount: string | number;
  status: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
  plan_id: string;
  email: string;
  nama_lengkap: string;
  whatsapp: string;
  notes: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface Stats {
  total_transactions: number;
  pending_count: number;
  paid_count: number;
  activated_count: number;
  refunded_count: number;
  expired_count: number;
  cancelled_count: number;
  gross_revenue: number;
  net_revenue: number;
  total_refunds: number;
  successful_transactions: number;
  average_transaction_value: number;
  conversion_rate: number;
}

interface TransactionsManagerProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function TransactionsManager({ onSuccess, onError }: TransactionsManagerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<{ [key: string]: boolean }>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal states
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Active sub-tab
  const [activeSubTab, setActiveSubTab] = useState<"list" | "finance">("list");

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (statusFilter) params.append("status", statusFilter);
      params.append("page", "1");
      params.append("limit", "20");
      params.append("sortBy", sortBy);
      params.append("sortOrder", sortOrder);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("includeStats", "true");

      const res = await fetch(`/api/admin/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setPagination(data.pagination);
        setStats(data.stats);
      } else {
        const err = await res.json();
        onError(err.error || "Gagal memuat transaksi");
      }
    } catch (e) {
      console.error(e);
      onError("Koneksi gagal saat memuat data transaksi");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, sortBy, sortOrder, startDate, endDate, onError]);

  const fetchPage = async (page: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (statusFilter) params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", "20");
      params.append("sortBy", sortBy);
      params.append("sortOrder", sortOrder);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("includeStats", "false");

      const res = await fetch(`/api/admin/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setPagination(data.pagination);
      } else {
        const err = await res.json();
        onError(err.error || "Gagal memuat halaman transaksi");
      }
    } catch (e) {
      console.error(e);
      onError("Koneksi gagal saat memuat data transaksi");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setSortBy("created_at");
    setSortOrder("DESC");
    setTimeout(fetchTransactions, 0);
  };

  const handleAction = async (txId: string, action: string) => {
    setIsProcessing((prev) => ({ ...prev, [txId]: true }));
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId, action })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.message || "Aksi berhasil diproses!");
        fetchTransactions();
      } else {
        onError(data.error || "Gagal memproses aksi");
      }
    } catch (e) {
      console.error(e);
      onError("Koneksi bermasalah saat memproses aksi");
    } finally {
      setIsProcessing((prev) => ({ ...prev, [txId]: false }));
    }
  };

  const openDetail = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setShowDetailModal(true);
  };

  const openFollowUp = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setShowFollowUpModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getPlanName = (planId: string) => {
    const plans: Record<string, string> = {
      "three_month": "3 Bulan",
      "six_month": "6 Bulan",
      "one_year": "1 Tahun",
      "free": "Free",
      "pro_monthly": "Pro Bulanan",
      "pro_yearly": "Pro Tahunan"
    };
    return plans[planId || ""] || planId || "-";
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; bg: string; label: string }> = {
      "PENDING": { color: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "Menunggu" },
      "PAID": { color: "text-blue-700", bg: "bg-blue-50 border-blue-200", label: "Sudah Bayar" },
      "ACTIVATED": { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", label: "Aktif" },
      "REFUNDED": { color: "text-rose-700", bg: "bg-rose-50 border-rose-200", label: "Direfund" },
      "EXPIRED": { color: "text-slate-700", bg: "bg-slate-100 border-slate-200", label: "Kadaluarsa" },
      "CANCELLED": { color: "text-slate-700", bg: "bg-slate-100 border-slate-200", label: "Dibatalkan" }
    };
    const config = configs[status] || { color: "text-slate-700", bg: "bg-slate-100 border-slate-200", label: status };
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black border ${config.bg} ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Calculate pending follow-up stats
  const pendingCount = stats?.pending_count || 0;
  const pendingAmount = transactions
    .filter(t => t.status === "PENDING")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="space-y-4">
      {/* Sub Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab("list")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            📋 Daftar Transaksi
          </button>
          <button
            onClick={() => setActiveSubTab("finance")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === "finance" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            📊 Dashboard Keuangan
          </button>
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
            <span className="text-amber-600 text-xs font-bold">⏳ {pendingCount} Transaksi Pending</span>
            <span className="text-amber-700 text-xs">•</span>
            <span className="text-amber-700 text-xs font-semibold">Total: {formatCurrency(pendingAmount)}</span>
          </div>
        )}
      </div>

      {activeSubTab === "list" ? (
        <>
          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari invoice, email, nama, WA..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium text-slate-800"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 outline-none"
              >
                <option value="">Semua Status</option>
                <option value="PENDING">Menunggu</option>
                <option value="PAID">Sudah Bayar</option>
                <option value="ACTIVATED">Aktif</option>
                <option value="REFUNDED">Direfund</option>
                <option value="EXPIRED">Kadaluarsa</option>
                <option value="CANCELLED">Dibatalkan</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 outline-none"
              >
                <option value="created_at">Tanggal</option>
                <option value="amount">Jumlah</option>
                <option value="status">Status</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "ASC" | "DESC")}
                className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 outline-none"
              >
                <option value="DESC">Terbaru</option>
                <option value="ASC">Terlama</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
              >
                🔍 Cari
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
              >
                Reset
              </button>
            </form>
          </div>

          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-3">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Total</p>
                <p className="text-lg font-black text-slate-800">{stats.total_transactions}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                <p className="text-[9px] text-amber-600 font-bold uppercase">Pending</p>
                <p className="text-lg font-black text-amber-700">{stats.pending_count}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                <p className="text-[9px] text-blue-600 font-bold uppercase">Sudah Bayar</p>
                <p className="text-lg font-black text-blue-700">{stats.paid_count}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                <p className="text-[9px] text-emerald-600 font-bold uppercase">Aktif</p>
                <p className="text-lg font-black text-emerald-700">{stats.activated_count}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3">
                <p className="text-[9px] text-purple-600 font-bold uppercase">Gross Revenue</p>
                <p className="text-sm font-black text-purple-700">{formatCurrency(stats.gross_revenue)}</p>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3">
                <p className="text-[9px] text-rose-600 font-bold uppercase">Total Refund</p>
                <p className="text-sm font-black text-rose-700">{formatCurrency(stats.total_refunds)}</p>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-20 text-slate-400 font-semibold">
                  <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                  Memuat riwayat transaksi...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-20 text-slate-400 italic">
                  Tidak ada data transaksi ditemukan.
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Transaksi & Tanggal</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Jumlah</th>
                      <th className="px-4 py-3 text-center">Paket</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openDetail(tx)}
                            className="text-left hover:text-indigo-600 transition"
                          >
                            <p className="font-semibold text-slate-800 text-[11px] truncate max-w-[140px]" title={tx.id}>
                              {tx.external_id || tx.id.substring(0, 8)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {new Date(tx.created_at).toLocaleString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800 text-xs">{tx.nama_lengkap || "(Tidak Ada)"}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{tx.email}</p>
                          <p className="text-[9px] text-slate-400 font-mono">+{tx.whatsapp || "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(tx.status)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                          {formatCurrency(Number(tx.amount))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                            {getPlanName(tx.plan_id)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => openDetail(tx)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                              title="Lihat Detail"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {tx.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => openFollowUp(tx)}
                                  className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-600 rounded-lg transition"
                                  title="Kirim Follow-Up"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleAction(tx.id, "activate")}
                                  disabled={isProcessing[tx.id]}
                                  className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-lg transition disabled:opacity-50"
                                  title="Aktifkan Paket"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              </>
                            )}
                            {(tx.status === "PAID" || tx.status === "ACTIVATED") && (
                              <button
                                onClick={() => {
                                  if (confirm("Refund transaksi ini?")) {
                                    handleAction(tx.id, "refund");
                                  }
                                }}
                                disabled={isProcessing[tx.id]}
                                className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-lg transition disabled:opacity-50"
                                title="Refund"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <p className="text-[10px] text-slate-500">
                  Menampilkan {(pagination.currentPage - 1) * pagination.limit + 1} - {Math.min(pagination.currentPage * pagination.limit, pagination.totalRecords)} dari {pagination.totalRecords} transaksi
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchPage(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage || isLoading}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let page = i + 1;
                    if (pagination.totalPages > 5) {
                      if (pagination.currentPage > 3) {
                        page = pagination.currentPage - 2 + i;
                      }
                      if (pagination.currentPage > pagination.totalPages - 2) {
                        page = pagination.totalPages - 4 + i;
                      }
                    }
                    if (page < 1 || page > pagination.totalPages) return null;
                    return (
                      <button
                        key={page}
                        onClick={() => fetchPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          page === pagination.currentPage
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchPage(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage || isLoading}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Finance Dashboard */
        <FinanceDashboard stats={stats} />
      )}

      {/* Modals */}
      {selectedTransaction && (
        <>
          <FollowUpModal
            isOpen={showFollowUpModal}
            onClose={() => {
              setShowFollowUpModal(false);
              setSelectedTransaction(null);
            }}
            transaction={selectedTransaction}
            onSuccess={() => {
              onSuccess("Follow-up berhasil dikirim!");
              fetchTransactions();
            }}
          />
          <TransactionDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedTransaction(null);
            }}
            transaction={selectedTransaction}
            onAction={(action) => handleAction(selectedTransaction.id, action)}
            onRefresh={fetchTransactions}
          />
        </>
      )}
    </div>
  );
}

// Finance Dashboard Component
function FinanceDashboard({ stats }: { stats: Stats | null }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!stats) {
    return (
      <div className="text-center py-20 text-slate-400 font-semibold">
        Memuat data keuangan...
      </div>
    );
  }

  const netProfit = stats.net_revenue - stats.total_refunds;
  const conversionRate = parseFloat(stats.conversion_rate?.toString() || "0");

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-3xl p-6 shadow-xl">
          <span className="text-xs font-bold block uppercase tracking-wider text-emerald-100">Pendapatan Kotor (Gross)</span>
          <span className="text-2xl font-black block mt-2">{formatCurrency(stats.gross_revenue)}</span>
          <span className="text-[10px] text-emerald-100 mt-1 block">Total pembayaran berhasil</span>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-3xl p-6 shadow-xl">
          <span className="text-xs font-bold block uppercase tracking-wider text-indigo-100">Pendapatan Bersih (Net)</span>
          <span className="text-2xl font-black block mt-2">{formatCurrency(stats.net_revenue)}</span>
          <span className="text-[10px] text-indigo-100 mt-1 block">Transaksi berhasil diaktifkan</span>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-3xl p-6 shadow-xl">
          <span className="text-xs font-bold block uppercase tracking-wider text-purple-100">Total Refund</span>
          <span className="text-2xl font-black block mt-2">{formatCurrency(stats.total_refunds)}</span>
          <span className="text-[10px] text-purple-100 mt-1 block">{stats.refunded_count} transaksi direfund</span>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-3xl p-6 shadow-xl">
          <span className="text-xs font-bold block uppercase tracking-wider text-rose-100">Keuntungan Bersih</span>
          <span className="text-2xl font-black block mt-2">{formatCurrency(netProfit)}</span>
          <span className="text-[10px] text-rose-100 mt-1 block">Net revenue - Refund</span>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Transaksi Berhasil</span>
          <span className="text-xl font-black text-emerald-600 block mt-1">{stats.successful_transactions}</span>
          <span className="text-[10px] text-slate-400">dari {stats.total_transactions} total</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Rata-rata Transaksi</span>
          <span className="text-xl font-black text-indigo-600 block mt-1">{formatCurrency(stats.average_transaction_value)}</span>
          <span className="text-[10px] text-slate-400">per transaksi sukses</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Conversion Rate</span>
          <span className="text-xl font-black text-purple-600 block mt-1">{conversionRate.toFixed(1)}%</span>
          <span className="text-[10px] text-slate-400">pending ke activated</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Pending</span>
          <span className="text-xl font-black text-amber-600 block mt-1">{stats.pending_count}</span>
          <span className="text-[10px] text-slate-400">menunggu pembayaran</span>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">📊 Distribusi Status Transaksi</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { key: "pending_count", label: "Pending", color: "bg-amber-500", count: stats.pending_count },
            { key: "paid_count", label: "Sudah Bayar", color: "bg-blue-500", count: stats.paid_count },
            { key: "activated_count", label: "Aktif", color: "bg-emerald-500", count: stats.activated_count },
            { key: "refunded_count", label: "Direfund", color: "bg-rose-500", count: stats.refunded_count },
            { key: "expired_count", label: "Kadaluarsa", color: "bg-slate-500", count: stats.expired_count },
            { key: "cancelled_count", label: "Dibatalkan", color: "bg-gray-500", count: stats.cancelled_count },
          ].map((item) => (
            <div key={item.key} className="text-center">
              <div className={`w-12 h-12 rounded-2xl ${item.color} mx-auto flex items-center justify-center text-white font-black text-lg`}>
                {item.count}
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-semibold">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}