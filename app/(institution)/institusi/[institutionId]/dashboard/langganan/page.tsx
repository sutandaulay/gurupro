"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { Card, Badge, Spinner } from "@/app/components/ui";
import { useToast } from "@/app/components/ui/toast";
import {
  IconCreditCard,
  IconCheck,
  IconAlertCircle,
  IconDownload,
  IconTrendingUp,
} from "@tabler/icons-react";

interface Plan {
  id: string;
  name: string;
  package_name: string;
  price: number;
  duration_days: number;
  tokens: number;
  features: string[];
  popular: boolean;
}

interface InstitutionSubscription {
  name: string;
  subscription_tier: string;
  status: string;
  npsn: string;
  jenjang: string;
}

interface Transaction {
  id: string;
  external_id: string;
  amount: number;
  status: string;
  created_at: string;
  notes: string | null;
  plan_id: string | null;
}

export default function LanggananPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const toast = useToast();
  const [institutionId, setInstitutionId] = useState<number | null>(null);
  const [institution, setInstitution] = useState<InstitutionSubscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"paket" | "riwayat">("paket");

  useEffect(() => {
    params.then((p) => setInstitutionId(parseInt(p.institutionId, 10)));
  }, [params]);

  const fetchData = async () => {
    if (!institutionId) return;
    setLoading(true);
    setError("");
    try {
      const [instRes, plansRes, userSubRes, txRes] = await Promise.all([
        apiFetch(`/api/institution/${institutionId}`),
        apiFetch("/api/pricing"),
        apiFetch("/api/user/token-status"),
        apiFetch("/api/user/transactions"),
      ]);

      const instData = instRes.ok ? await instRes.json() : null;
      const plansData = plansRes.ok ? await plansRes.json() : { plans: [] };
      const userSubData = userSubRes.ok ? await userSubRes.json() : null;
      const txData = txRes.ok ? await txRes.json() : null;

      setInstitution(instData);
      setPlans(plansData.plans || []);
      setUserSubscription(userSubData);
      setTransactions(txData?.transactions || []);
    } catch {
      setError("Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (institutionId) fetchData();
  }, [institutionId]);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      const res = await apiFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memproses upgrade.");
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.success("Langganan berhasil diaktifkan!");
        fetchData();
      }
    } catch {
      toast.error("Gagal memproses upgrade.");
    } finally {
      setUpgrading(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const daysUntilExpiry = userSubscription?.subscription_end
    ? Math.max(
        0,
        Math.ceil(
          (new Date(userSubscription.subscription_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const isExpired = userSubscription?.subscription_status === "locked" ||
    (userSubscription?.subscription_end && new Date(userSubscription.subscription_end) < new Date());

  const statusVariant = (status: string): "default" | "success" | "warning" | "error" => {
    if (status === "ACTIVATED" || status === "active") return "success";
    if (status === "PENDING") return "warning";
    if (status === "EXPIRED" || status === "DENIED") return "error";
    return "default";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Langganan & Billing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola paket langganan dan riwayat pembayaran.
        </p>
      </div>

      {/* Subscription Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-sm text-gray-500">Paket Aktif</p>
          <p className="text-xl font-bold text-gray-900 capitalize mt-1">
            {userSubscription?.status_langganan || institution?.subscription_tier || "Free"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Status</p>
          <Badge variant={isExpired ? "error" : "success"} className="mt-1 capitalize">
            {isExpired ? "Expired" : userSubscription?.subscription_status || "Active"}
          </Badge>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Berakhir</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {userSubscription?.subscription_end
              ? formatDate(userSubscription.subscription_end)
              : "—"}
          </p>
          {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">
              {daysUntilExpiry} hari lagi
            </p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Poin Tersedia</p>
          <p className="text-xl font-bold text-violet-600 mt-1">
            {userSubscription?.quota_poin_available?.toLocaleString("id-ID") ??
              userSubscription?.total_token_balance?.toLocaleString("id-ID") ??
              "0"}
          </p>
          {userSubscription?.quota_poin_used !== undefined && (
            <p className="text-xs text-gray-400 mt-0.5">
              Terpakai: {userSubscription.quota_poin_used.toLocaleString("id-ID")}
            </p>
          )}
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["paket", "riwayat"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === t
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "paket" ? "Paket Tersedia" : "Riwayat Pembayaran"}
          </button>
        ))}
      </div>

      {tab === "paket" ? (
        <>
          {error ? (
            <Card className="p-12 text-center">
              <IconAlertCircle size={40} className="mx-auto text-red-400 mb-3" />
              <p className="text-red-600">{error}</p>
            </Card>
          ) : plans.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-gray-500">Tidak ada paket tersedia.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent =
                  userSubscription?.status_langganan?.toLowerCase() ===
                  plan.package_name?.toLowerCase();
                return (
                  <Card
                    key={plan.id}
                    className={`relative overflow-hidden ${
                      plan.popular ? "ring-2 ring-violet-500" : ""
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                        POPULER
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <div className="mt-2">
                        <span className="text-2xl font-bold text-gray-900">
                          {plan.price === 0 ? "Gratis" : formatCurrency(plan.price)}
                        </span>
                        {plan.duration_days > 0 && (
                          <span className="text-sm text-gray-500 ml-1">
                            / {plan.duration_days} hari
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <span className="text-sm text-violet-600 font-medium">
                          {plan.tokens.toLocaleString("id-ID")} Poin
                        </span>
                      </div>
                      <ul className="mt-4 space-y-1.5">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <IconCheck size={14} className="text-green-500 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading !== null || isCurrent}
                        className={`mt-5 w-full py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isCurrent
                            ? "bg-gray-100 text-gray-400"
                            : plan.popular
                              ? "bg-violet-600 hover:bg-violet-700 text-white"
                              : "bg-gray-900 hover:bg-gray-800 text-white"
                        }`}
                      >
                        {upgrading === plan.id
                          ? "Memproses..."
                          : isCurrent
                            ? "Paket Saat Ini"
                            : plan.price === 0
                              ? "Aktifkan Gratis"
                              : "Berlangganan"}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Riwayat Tab */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tanggal</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">ID Transaksi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Paket</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Jumlah</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                      Belum ada riwayat pembayaran.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{formatDate(tx.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{tx.external_id || tx.id}</td>
                      <td className="px-4 py-3 text-gray-900">
                        {tx.notes?.replace(/Processed via.*/, "").trim() || tx.plan_id || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {tx.amount === 0 ? "Gratis" : formatCurrency(Number(tx.amount))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={statusVariant(tx.status)} className="capitalize">
                          {tx.status === "ACTIVATED"
                            ? "Berhasil"
                            : tx.status === "PENDING"
                              ? "Menunggu"
                              : tx.status === "EXPIRED"
                                ? "Kedaluwarsa"
                                : tx.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
