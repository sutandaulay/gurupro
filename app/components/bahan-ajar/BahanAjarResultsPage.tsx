/**
 * BahanAjarResultsPage Component
 *
 * Halaman hasil Bahan Ajar dengan 3 tab: Slide / LKPD / Handout
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  IconArrowLeft,
  IconPresentation,
  IconFileText,
  IconBook,
  IconLoader2,
  IconAlertCircle,
  IconCoins,
} from "@tabler/icons-react";
import ComplianceBadge from "./ComplianceBadge";
import SlidePreview from "./SlidePreview";
import LKPDPreview from "./LKPDPreview";
import HandoutPreview from "./HandoutPreview";
import TokenHabisModal from "@/app/components/ui/TokenHabisModal";

interface BahanAjarData {
  id: string;
  status: string;
  slidesOutline?: any;
  lkpd?: any;
  handout?: string | null;
  complianceChecklist?: any;
  tokenCost?: number;
  errorMessage?: string;
  modulAjar?: {
    id: string;
    namaModul: string;
    mapel: string;
    jenjang: string;
    kurikulum: string;
  };
  createdAt: string;
}

type TabType = "slide" | "lkpd" | "handout";

export default function BahanAjarResultsPage() {
  const params = useParams();
  const router = useRouter();
  const bahanAjarId = params?.id as string;

  const [data, setData] = useState<BahanAjarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("slide");
  const [regeneratingTab, setRegeneratingTab] = useState<TabType | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenShortfall, setTokenShortfall] = useState(0);

  // Fetch bahan ajar data
  useEffect(() => {
    if (!bahanAjarId) return;
    fetchBahanAjar();
  }, [bahanAjarId]);

  const fetchBahanAjar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bahan-ajar/${bahanAjarId}`);
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Gagal mengambil data");
        return;
      }

      setData(result);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (jenis: TabType) => {
    setRegeneratingTab(jenis);
    setError(null);

    try {
      const res = await fetch(`/api/bahan-ajar/${bahanAjarId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenis }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          // Token not enough
          setTokenShortfall(result.error?.match(/\d+/) || 0);
          setShowTokenModal(true);
          return;
        }
        setError(result.error || "Gagal regenerate");
        return;
      }

      // Refresh data
      await fetchBahanAjar();
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setRegeneratingTab(null);
    }
  };

  const handleExport = (jenis: TabType) => {
    const formatMap: Record<TabType, string> = {
      slide: "pptx",
      lkpd: "pdf",
      handout: "docx",
    };

    window.open(
      `/api/bahan-ajar/${bahanAjarId}/export?format=${formatMap[jenis]}&jenis=${jenis}`,
      "_blank"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconAlertCircle size={32} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Terjadi Kesalahan
          </h2>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
          >
            <IconArrowLeft size={16} />
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    {
      key: "slide",
      label: "Slide",
      icon: <IconPresentation size={18} />,
    },
    {
      key: "lkpd",
      label: "LKPD",
      icon: <IconBook size={18} />,
    },
    {
      key: "handout",
      label: "Handout",
      icon: <IconFileText size={18} />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Back Button */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <IconArrowLeft size={16} />
            Kembali ke Dashboard
          </Link>

          {/* Title & Info */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {data?.modulAjar?.namaModul || "Bahan Ajar"}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span>{data?.modulAjar?.mapel}</span>
                <span>•</span>
                <span>{data?.modulAjar?.jenjang}</span>
                <span>•</span>
                <span>{data?.modulAjar?.kurikulum}</span>
              </div>
            </div>

            {/* Compliance Badge - Main element */}
            <ComplianceBadge
              complianceCheck={data?.complianceChecklist}
              className="mt-1"
            />
          </div>

          {/* Token Cost */}
          {data?.tokenCost !== undefined && data.tokenCost > 0 && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
              <IconCoins size={14} />
              <span>Token terpakai: {data.tokenCost.toLocaleString()}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all ${
                  activeTab === tab.key
                    ? "bg-violet-50 text-violet-700 border-b-2 border-violet-600"
                    : "bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <IconAlertCircle
                size={20}
                className="text-red-500 flex-shrink-0 mt-0.5"
              />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {activeTab === "slide" && (
            <SlidePreview
              slides={data?.slidesOutline}
              onRegenerate={() => handleRegenerate("slide")}
              onExport={() => handleExport("slide")}
              isRegenerating={regeneratingTab === "slide"}
            />
          )}

          {activeTab === "lkpd" && (
            <LKPDPreview
              lkpd={data?.lkpd}
              onRegenerate={() => handleRegenerate("lkpd")}
              onExport={() => handleExport("lkpd")}
              isRegenerating={regeneratingTab === "lkpd"}
            />
          )}

          {activeTab === "handout" && (
            <HandoutPreview
              handout={data?.handout}
              onRegenerate={() => handleRegenerate("handout")}
              onExport={() => handleExport("handout")}
              isRegenerating={regeneratingTab === "handout"}
            />
          )}
        </div>
      </div>

      {/* Token Habis Modal */}
      <TokenHabisModal
        open={showTokenModal}
        shortfall={tokenShortfall}
        onClose={() => setShowTokenModal(false)}
        onBuyTopUp={() => {
          setShowTokenModal(false);
          router.push("/dashboard#topup");
        }}
        onUpgrade={() => {
          setShowTokenModal(false);
          router.push("/pricing");
        }}
      />
    </div>
  );
}
