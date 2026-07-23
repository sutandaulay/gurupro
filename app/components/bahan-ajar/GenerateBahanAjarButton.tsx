/**
 * GenerateBahanAjarButton Component
 *
 * Tombol untuk generate Bahan Ajar (Slide, LKPD, Handout)
 * Hanya aktif kalau Modul Ajar status = completed
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconSparkles, IconLock } from "@tabler/icons-react";

interface GenerateBahanAjarButtonProps {
  modulAjarId?: string;       // optional for standalone
  modulAjarStatus?: string;
  modulAjarName?: string;
  modulAjarData?: {
    jenjang?: string;
    fase?: string;
    mapel?: string;
    kelas?: string;
    cp?: string;
    tp?: string[];
    atp?: any;
    topik?: string;
    materiPokok?: string[];
    jumlahPertemuan?: number;
    alokasiWaktu?: string;
  };
  jumlahPertemuan?: number;
  onGenerateSuccess?: (bahanAjarId: string) => void;
}

export default function GenerateBahanAjarButton({
  modulAjarId,
  modulAjarStatus,
  modulAjarName,
  modulAjarData,
  jumlahPertemuan = 4,
  onGenerateSuccess,
}: GenerateBahanAjarButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const isCompleted = modulAjarStatus === "completed";
  const isGenerating = modulAjarStatus === "generating";

  if (!modulAjarId) {
    // Standalone mode - no Modul Ajar
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200"
        >
          <IconSparkles size={18} />
          Generate Bahan Ajar
        </button>

        {showModal && (
          <GenerateConfirmationModal
            modulAjarId={null}
            modulAjarName={null}
            modulAjarData={null}
            jumlahPertemuan={jumlahPertemuan}
            onClose={() => setShowModal(false)}
            onSuccess={(bahanAjarId) => {
              setShowModal(false);
              onGenerateSuccess?.(bahanAjarId);
            }}
          />
        )}
      </>
    );
  }

  if (!isCompleted) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed"
        title={
          isGenerating
            ? "Sedang memproses..."
            : "Selesaikan Modul Ajar terlebih dahulu untuk membuat Bahan Ajar"
        }
      >
        <IconLock size={18} />
        Generate Bahan Ajar
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200"
      >
        <IconSparkles size={18} />
        Generate Bahan Ajar
      </button>

      {showModal && (
        <GenerateConfirmationModal
          modulAjarId={modulAjarId}
          modulAjarName={modulAjarName}
          modulAjarData={modulAjarData}
          jumlahPertemuan={jumlahPertemuan}
          onClose={() => setShowModal(false)}
          onSuccess={(bahanAjarId) => {
            setShowModal(false);
            onGenerateSuccess?.(bahanAjarId);
          }}
        />
      )}
    </>
  );
}

// ============================================
// GenerateConfirmationModal
// ============================================

interface GenerateConfirmationModalProps {
  modulAjarId: string | null;
  modulAjarName: string | null;
  modulAjarData: {
    jenjang?: string;
    fase?: string;
    mapel?: string;
    kelas?: string;
    cp?: string;
    tp?: string[];
    atp?: any;
    topik?: string;
    materiPokok?: string[];
    jumlahPertemuan?: number;
    alokasiWaktu?: string;
  } | null;
  jumlahPertemuan: number;
  onClose: () => void;
  onSuccess: (bahanAjarId: string) => void;
}

// Standalone form state
interface StandaloneForm {
  jenjang: string;
  fase: string;
  mapel: string;
  kelas: string;
  topik: string;
  tujuanPembelajaran: string;
  cp: string;
  jumlahPertemuan: number;
  alokasiWaktu: string;
}

const defaultStandaloneForm: StandaloneForm = {
  jenjang: "SD",
  fase: "B",
  mapel: "",
  kelas: "",
  topik: "",
  tujuanPembelajaran: "",
  cp: "",
  jumlahPertemuan: 4,
  alokasiWaktu: "35 menit",
};

function GenerateConfirmationModal({
  modulAjarId,
  modulAjarName,
  modulAjarData,
  jumlahPertemuan,
  onClose,
  onSuccess,
}: GenerateConfirmationModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quotaInfo, setQuotaInfo] = useState<{
    remaining: number;
    estimatedCost: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutputs, setSelectedOutputs] = useState({
    slide: true,
    lkpd: false,
    handout: true,
  });

  // Mode: 'modul-ajar' or 'standalone'
  const [mode, setMode] = useState<'modul-ajar' | 'standalone'>(
    modulAjarId ? 'modul-ajar' : 'standalone'
  );

  // Standalone form state
  const [standaloneForm, setStandaloneForm] = useState<StandaloneForm>({
    ...defaultStandaloneForm,
    jenjang: modulAjarData?.jenjang || defaultStandaloneForm.jenjang,
    fase: modulAjarData?.fase || defaultStandaloneForm.fase,
    mapel: modulAjarData?.mapel || "",
    kelas: modulAjarData?.kelas || "",
    topik: modulAjarData?.topik || "",
    cp: modulAjarData?.cp || "",
    jumlahPertemuan: modulAjarData?.jumlahPertemuan || defaultStandaloneForm.jumlahPertemuan,
    alokasiWaktu: modulAjarData?.alokasiWaktu || defaultStandaloneForm.alokasiWaktu,
  });

  // v2 Options
  const [jumlahSlideTarget, setJumlahSlideTarget] = useState(10);
  const [gayaVisual, setGayaVisual] = useState<"minimalis" | "ilustratif" | "akademis">("minimalis");
  const [handoutVersi, setHandoutVersi] = useState<"guru" | "siswa">("guru");

  // Fetch quota info
  useEffect(() => {
    fetchQuotaInfo();
  }, []);

  const calculateEstimatedCost = (outputs: typeof selectedOutputs) => {
    const selectedCount = Object.values(outputs).filter(Boolean).length;
    // v2 token estimates: ~800-1200 per output type
    const costPerOutput = selectedOutputs.slide ? 1200 + (jumlahSlideTarget * 50) : 0;
    const lkpdCost = selectedOutputs.lkpd ? 1000 + (jumlahPertemuan * 100) : 0;
    const handoutCost = selectedOutputs.handout ? 800 : 0;
    const complianceCost = selectedCount > 0 ? 200 : 0;
    return costPerOutput + lkpdCost + handoutCost + complianceCost;
  };

  const fetchQuotaInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/token-status");
      if (res.ok) {
        const data = await res.json();
        const estimatedCost = calculateEstimatedCost(selectedOutputs);
        setQuotaInfo({
          remaining: data.total_token_balance || 0,
          estimatedCost,
        });
      }
    } catch (e) {
      console.error("Failed to fetch quota:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleOutput = (key: keyof typeof selectedOutputs) => {
    const newSelected = { ...selectedOutputs, [key]: !selectedOutputs[key] };
    // Ensure at least one is selected
    if (Object.values(newSelected).some(Boolean)) {
      setSelectedOutputs(newSelected);
      // Recalculate estimated cost
      const estimatedCost = calculateEstimatedCost(newSelected);
      setQuotaInfo((prev) =>
        prev ? { ...prev, estimatedCost } : null
      );
    }
  };

  const handleGenerate = async () => {
    const jenisOutput = Object.entries(selectedOutputs)
      .filter(([, selected]) => selected)
      .map(([key]) => key);

    if (jenisOutput.length === 0) {
      setError("Pilih minimal satu jenis output");
      return;
    }

    // Validate standalone form if in standalone mode
    if (mode === 'standalone') {
      if (!standaloneForm.mapel.trim()) {
        setError("Mata Pelajaran wajib diisi");
        return;
      }
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Build request body based on mode
      const requestBody: any = {
        jenisOutput,
        // v2 options
        jumlahSlideTarget: selectedOutputs.slide ? jumlahSlideTarget : undefined,
        gayaVisual: selectedOutputs.slide ? gayaVisual : undefined,
        handoutVersi: selectedOutputs.handout ? handoutVersi : undefined,
      };

      // Add modulAjarId if available (from Modul Ajar mode)
      if (mode === 'modul-ajar' && modulAjarId) {
        requestBody.modulAjarId = modulAjarId;
      } else {
        // Standalone mode - send form data
        requestBody.standalone = true;
        requestBody.jenjang = standaloneForm.jenjang;
        requestBody.fase = standaloneForm.fase;
        requestBody.mapel = standaloneForm.mapel;
        requestBody.kelas = standaloneForm.kelas;
        requestBody.topik = standaloneForm.topik;
        requestBody.tujuanPembelajaran = standaloneForm.tujuanPembelajaran;
        requestBody.cp = standaloneForm.cp;
        requestBody.jumlahPertemuan = standaloneForm.jumlahPertemuan;
        requestBody.alokasiWaktu = standaloneForm.alokasiWaktu;
      }

      const res = await fetch("/api/bahan-ajar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setError(
            `Poin tidak cukup. ${data.error}. Sisa poin: ${quotaInfo?.remaining || 0}`
          );
          return;
        }
        setError(data.error || "Gagal generate bahan ajar");
        return;
      }

      onSuccess(data.bahanAjarId);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setIsGenerating(false);
    }
  };

  const hasEnoughQuota =
    quotaInfo && quotaInfo.remaining >= quotaInfo.estimatedCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <IconSparkles size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Generate Bahan Ajar
                </h3>
                <p className="text-xs text-violet-100 line-clamp-1">
                  {mode === 'standalone' ? 'Mode Standalone' : (modulAjarName || 'Dari Modul Ajar')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Memuat informasi kuota...</p>
            </div>
          ) : (
            <>
              {/* Mode Selection */}
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Pilih Sumber Data:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('modul-ajar')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      mode === 'modul-ajar'
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">📚</span>
                      <span className="font-semibold text-sm text-gray-800">Dari Modul Ajar</span>
                    </div>
                    <p className="text-xs text-gray-500">Pakai data dari Modul Ajar yang sudah ada</p>
                  </button>
                  <button
                    onClick={() => setMode('standalone')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      mode === 'standalone'
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">✨</span>
                      <span className="font-semibold text-sm text-gray-800">Standalone</span>
                    </div>
                    <p className="text-xs text-gray-500">Buat langsung tanpa Modul Ajar</p>
                  </button>
                </div>
              </div>

              {/* Standalone Form */}
              {mode === 'standalone' && (
                <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    📝 Informasi Pembelajaran
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Jenjang</label>
                        <select
                          value={standaloneForm.jenjang}
                          onChange={(e) => setStandaloneForm({...standaloneForm, jenjang: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="SD">SD</option>
                          <option value="SMP">SMP</option>
                          <option value="SMA">SMA</option>
                          <option value="SMK">SMK</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Fase</label>
                        <select
                          value={standaloneForm.fase}
                          onChange={(e) => setStandaloneForm({...standaloneForm, fase: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="A">Fase A</option>
                          <option value="B">Fase B</option>
                          <option value="C">Fase C</option>
                          <option value="D">Fase D</option>
                          <option value="E">Fase E</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Mata Pelajaran *</label>
                      <input
                        type="text"
                        value={standaloneForm.mapel}
                        onChange={(e) => setStandaloneForm({...standaloneForm, mapel: e.target.value})}
                        placeholder="Contoh: Matematika"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Kelas</label>
                      <input
                        type="text"
                        value={standaloneForm.kelas}
                        onChange={(e) => setStandaloneForm({...standaloneForm, kelas: e.target.value})}
                        placeholder="Contoh: Kelas 4"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Topik Pembelajaran</label>
                      <input
                        type="text"
                        value={standaloneForm.topik}
                        onChange={(e) => setStandaloneForm({...standaloneForm, topik: e.target.value})}
                        placeholder="Contoh: Pecahan"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Tujuan Pembelajaran</label>
                      <textarea
                        value={standaloneForm.tujuanPembelajaran}
                        onChange={(e) => setStandaloneForm({...standaloneForm, tujuanPembelajaran: e.target.value})}
                        placeholder="Contoh: Siswa dapat memahami konsep pecahan sederhana"
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Capaian Pembelajaran (CP)</label>
                      <textarea
                        value={standaloneForm.cp}
                        onChange={(e) => setStandaloneForm({...standaloneForm, cp: e.target.value})}
                        placeholder="Opsional - akan dipakai sebagai acuan jika diisi"
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Jumlah Pertemuan</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={standaloneForm.jumlahPertemuan}
                          onChange={(e) => setStandaloneForm({...standaloneForm, jumlahPertemuan: Number(e.target.value)})}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Alokasi Waktu</label>
                        <input
                          type="text"
                          value={standaloneForm.alokasiWaktu}
                          onChange={(e) => setStandaloneForm({...standaloneForm, alokasiWaktu: e.target.value})}
                          placeholder="Contoh: 35 menit"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Output Selection */}
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Pilih Output yang Ingin Dibuat:
                </p>
                <div className="space-y-2">
                  {[
                    {
                      key: "slide",
                      label: "Slide Presentasi",
                      desc: "Outline slide untuk presentasi pembelajaran",
                      icon: "📊",
                    },
                    {
                      key: "lkpd",
                      label: "LKPD",
                      desc: "Lembar Kerja Peserta Didik",
                      icon: "📝",
                    },
                    {
                      key: "handout",
                      label: "Handout",
                      desc: "Bahan ajar cetak untuk peserta didik",
                      icon: "📖",
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedOutputs[item.key as keyof typeof selectedOutputs]
                          ? "border-violet-500 bg-violet-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedOutputs[item.key as keyof typeof selectedOutputs]
                        }
                        onChange={() =>
                          toggleOutput(item.key as keyof typeof selectedOutputs)
                        }
                        className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-xl">{item.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* v2 Options - Slide Settings */}
              {selectedOutputs.slide && (
                <div className="mb-5 p-4 bg-violet-50 rounded-xl border border-violet-200">
                  <p className="text-sm font-semibold text-violet-700 mb-3">
                    ⚙️ Pengaturan Slide
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Jumlah Slide</label>
                      <input
                        type="number"
                        min={3}
                        max={30}
                        value={jumlahSlideTarget}
                        onChange={(e) => setJumlahSlideTarget(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">±2 diperbolehkan</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Gaya Visual</label>
                      <select
                        value={gayaVisual}
                        onChange={(e) => setGayaVisual(e.target.value as any)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      >
                        <option value="minimalis">Minimalis</option>
                        <option value="ilustratif">Ilustratif</option>
                        <option value="akademis">Akademis</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* v2 Options - Handout Settings */}
              {selectedOutputs.handout && (
                <div className="mb-5 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-sm font-semibold text-amber-700 mb-3">
                    ⚙️ Pengaturan Handout
                  </p>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Versi Handout</label>
                    <div className="flex gap-3">
                      <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        handoutVersi === "guru"
                          ? "border-violet-500 bg-white"
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <input
                          type="radio"
                          name="handoutVersi"
                          value="guru"
                          checked={handoutVersi === "guru"}
                          onChange={() => setHandoutVersi("guru")}
                          className="w-4 h-4 text-violet-600"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Versi Guru</p>
                          <p className="text-[10px] text-gray-500">Dengan kunci jawaban</p>
                        </div>
                      </label>
                      <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        handoutVersi === "siswa"
                          ? "border-violet-500 bg-white"
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <input
                          type="radio"
                          name="handoutVersi"
                          value="siswa"
                          checked={handoutVersi === "siswa"}
                          onChange={() => setHandoutVersi("siswa")}
                          className="w-4 h-4 text-violet-600"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Versi Siswa</p>
                          <p className="text-[10px] text-gray-500">Tanpa kunci jawaban</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Poin Info */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    Estimasi Poin:
                  </span>
                  <span className="text-sm font-bold text-violet-600">
                    ~{quotaInfo?.estimatedCost.toLocaleString() || 0} poin
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Sisa Kuota:</span>
                  <span
                    className={`text-sm font-bold ${
                      hasEnoughQuota ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {quotaInfo?.remaining.toLocaleString() || 0} poin
                  </span>
                </div>
              </div>

              {/* Quota Warning */}
              {!hasEnoughQuota && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800 mb-1">
                        Poin Tidak Cukup
                      </p>
                      <p className="text-xs text-amber-700 mb-3">
                        Anda membutuhkan{" "}
                        {Math.max(
                          0,
                          (quotaInfo?.estimatedCost || 0) -
                            (quotaInfo?.remaining || 0)
                        ).toLocaleString()}{" "}
                         poin lagi untuk melanjutkan.
                      </p>
                      <button
                        onClick={() => {
                          onClose();
                          // Navigate to pricing/topup
                          router.push("/dashboard#topup");
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Beli Poin Ekstra
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !hasEnoughQuota}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/25 transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <IconSparkles size={18} />
                      Buat Sekarang
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
