"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CreditCard, Coins, Crown, Gift, AlertCircle, CheckCircle, Clock, Shield, Loader2 } from "lucide-react";

interface TokenStatus {
  id: string;
  email: string;
  nama_lengkap: string;
  subscription_status: string;
  subscription_end: string | null;
  grace_period_ends_at: string | null;
  token_limit: number;
  addon_token_balance: number;
  total_token_balance: number;
  hasAccess: boolean;
  reason: string;
}

interface PricingPlan {
  id: string;
  name: string;
  package_name: string;
  price: number;
  duration_days: number;
  tokens: number;
  features: string[];
  popular: boolean;
}

interface TokenPackage {
  id: string;
  name: string;
  poin_amount: number;
  price: number;
  description: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-green-100", text: "text-green-700", label: "Aktif" },
    grace_period: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Masa Tenggang" },
    locked: { bg: "bg-red-100", text: "text-red-700", label: "Terbatas" },
    expired: { bg: "bg-gray-100", text: "text-gray-700", label: "Berakhir" },
  };
  const config = statusMap[status] || statusMap.expired;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

export default function BillingPage() {
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"subscription" | "token">("subscription");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [preselectedPlan, setPreselectedPlan] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchData();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "token") {
        setActiveTab("token");
      }
      const checkout = params.get("checkout");
      if (checkout) {
        setActiveTab("subscription");
        setPreselectedPlan(checkout);
      }
    }
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [tokenRes, pricingRes, tokenPkgRes] = await Promise.all([
        fetch("/api/user/token-status"),
        fetch("/api/pricing"),
        fetch("/api/token-packages"),
      ]);

      const tokenData = await tokenRes.json();
      const pricingData = await pricingRes.json();
      const tokenPkgData = await tokenPkgRes.json();

      setTokenStatus(tokenData);
      setPlans(pricingData.plans || []);
      setPackages(tokenPkgData.packages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(planId: string, isAddon: boolean = false, packageId?: string) {
    try {
      setCheckingOut(isAddon ? `addon-${packageId}` : `plan-${planId}`);
      const payload: any = { plan: planId };
      if (isAddon && packageId) {
        payload.plan = "addon";
        payload.packageId = packageId;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal memproses checkout");
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setCheckingOut(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 bg-red-50 rounded-lg">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-100 hover:text-white mb-4 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <CreditCard className="w-8 h-8" />
            Billing & Langganan
          </h1>
           <p className="text-blue-100 mt-1">Kelola langganan dan poin akun Anda</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
         {/* Poin Balance Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                <Coins className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                 <p className="text-sm text-gray-500">Total Poin</p>
                <p className="text-3xl font-bold text-gray-900">
                  {tokenStatus?.total_token_balance || 0}
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                 <p className="text-xs text-gray-500 uppercase tracking-wide">Poin Utama</p>
                <p className="text-xl font-semibold text-gray-900">{tokenStatus?.token_limit || 0}</p>
              </div>
              <div className="text-center">
                 <p className="text-xs text-gray-500 uppercase tracking-wide">Top-up</p>
                 <div className="mt-1">
                   <p className="text-xl font-semibold text-green-600">{tokenStatus?.addon_token_balance || 0}</p>
                   <p className="text-xs text-gray-500">Poin Ekstra</p>
                  </div>
                </div>
               <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                <div className="mt-1">
                  {getStatusBadge(tokenStatus?.subscription_status || "active")}
                </div>
              </div>
            </div>
            
            <div className="flex items-center shrink-0">
              <button
                onClick={() => setActiveTab("token")}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-sm shadow-green-500/10"
              >
                <Coins className="w-4 h-4" />
                Beli Poin Ekstra
              </button>
            </div>
          </div>

          {/* Subscription Info */}
          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tokenStatus?.hasAccess ? "bg-green-100" : "bg-red-100"}`}>
                {tokenStatus?.hasAccess ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Akses</p>
                <p className={`font-medium ${tokenStatus?.hasAccess ? "text-green-600" : "text-red-600"}`}>
                  {tokenStatus?.hasAccess ? "Aktif" : "Terbatas"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Berakhir</p>
                <p className="font-medium text-gray-900">
                  {formatDate(tokenStatus?.subscription_end || null)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900 truncate">{tokenStatus?.email}</p>
              </div>
            </div>
          </div>

          {!tokenStatus?.hasAccess && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                 <p className="font-medium text-yellow-800">Poin Habis</p>
                <p className="text-sm text-yellow-700 mt-1">
                  {tokenStatus?.reason === "locked"
                    ? "Akun Anda terkunci. Hubungi CS untuk membuka kembali."
                     : tokenStatus?.reason === "Poin habis"
                     ? "Silakan upgrade paket atau top-up poin untuk melanjutkan."
                    : "Langganan Anda telah berakhir. Perpanjang untuk melanjutkan."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("subscription")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "subscription"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Paket Langganan
          </button>
          <button
            onClick={() => setActiveTab("token")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "token"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Top-up Poin
          </button>
        </div>

        {/* Pricing Plans */}
        {activeTab === "subscription" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border-2 ${
                  plan.popular ? "border-blue-500 shadow-lg" : "border-gray-200"
                } ${preselectedPlan === plan.id ? "ring-4 ring-blue-300" : ""} overflow-hidden transition-transform hover:scale-[1.02]`}
              >
                {plan.popular && (
                  <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">
                    <Crown className="w-4 h-4 inline mr-1" />
                    Paling Populer
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{plan.duration_days} hari</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatCurrency(plan.price)}
                    </span>
                    <span className="text-gray-500">/{plan.duration_days} hari</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                    <Gift className="w-4 h-4" />
                     <span>{plan.tokens} Poin Kuota</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {(plan.features || []).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={checkingOut !== null}
                    className={`w-full mt-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      plan.price === 0
                        ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    } ${checkingOut ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {checkingOut === `plan-${plan.id}` ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      plan.price === 0 ? "Gratis" : "Pilih Paket"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

         {/* Poin Packages */}
        {activeTab === "token" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Coins className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{pkg.poin_amount}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(pkg.price)}
                  </span>
                  <span className="text-gray-500 text-sm">/ {pkg.poin_amount} poin</span>
                </div>
                <button
                  onClick={() => handleCheckout("addon", true, pkg.id)}
                  disabled={checkingOut !== null}
                  className={`w-full mt-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    checkingOut ? "opacity-50 cursor-not-allowed bg-gray-400" : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {checkingOut === `addon-${pkg.id}` ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Top-up Sekarang"
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-blue-50 rounded-xl border border-blue-100 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Butuh Bantuan?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Hubungi tim support kami untuk pertanyaan tentang billing, upgrade paket, atau
                masalah lainnya.
              </p>
              <a
                href="https://wa.me/6281283960337"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Hubungi WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
