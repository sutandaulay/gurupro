"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";

interface PreviewData {
  institusi: string;
  jenjang: string;
  tahunAjaran: string;
  tanggal: string;
  kehadiranGuru: {
    totalGuru: number;
    hadir: number;
    telat: number;
    izin: number;
    sakit: number;
    alpa: number;
    belumAbsen: number;
  };
  kehadiranSiswa: { totalSiswa: number; hadir: number };
  raport: { total: number; byStatus: Record<string, number> };
  dokumenAdministrasi: Record<string, number>;
  strukturStaf: Record<string, number>;
  insiden: { telatBerulang: { nama: string; jumlahTelat: number }[]; belumTerassign: string[] };
}

interface RingkasanResult {
  ringkasan_eksekutif: string;
  poin_positif: string[];
  area_perhatian: string[];
  rekomendasi: { judul: string; detail: string }[];
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function AiRingkasanContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<RingkasanResult | null>(null);
  const [error, setError] = useState("");

  const loadPreview = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/ai-ringkasan`);
      const data = await res.json();
      if (res.ok) {
        setFeatureEnabled(Boolean(data.featureEnabled));
        setAiConfigured(data.aiConfigured !== false);
        setPreview(data.preview || null);
      } else {
        setFeatureEnabled(false);
        setError(data.error || "Gagal memuat data");
      }
    } catch {
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleGenerate = async () => {
    if (!institutionId || generating) return;
    setGenerating(true);
    setResult(null);
    setStreamText("");
    setError("");
    try {
      const res = await fetch(`/api/institution/${institutionId}/ai-ringkasan`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memulai generation");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.step === "chunk") {
            setStreamText((prev) => prev + (data.text || ""));
          } else if (data.step === "complete") {
            setResult(data.result);
          } else if (data.step === "error") {
            throw new Error(data.message);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Gagal generate ringkasan");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ringkasan Laporan</h1>
        <p className="text-sm text-gray-500">
          Ringkasan eksekutif berbasis AI untuk Kepala Sekolah &amp; Wakasek
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : featureEnabled === false ? (
        <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          Fitur Ringkasan AI belum aktif untuk institusi ini. Aktifkan fitur Command Center lewat pengaturan institusi.
        </div>
      ) : (
        <>
          {preview && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Kehadiran Guru"
                value={`${preview.kehadiranGuru.hadir}/${preview.kehadiranGuru.totalGuru}`}
                sub={`telat ${preview.kehadiranGuru.telat} · izin ${preview.kehadiranGuru.izin} · sakit ${preview.kehadiranGuru.sakit} · alpa ${preview.kehadiranGuru.alpa}`}
              />
              <StatCard
                label="Kehadiran Siswa"
                value={`${preview.kehadiranSiswa.hadir}/${preview.kehadiranSiswa.totalSiswa}`}
                sub={preview.tanggal}
              />
              <StatCard
                label="E-Raport"
                value={preview.raport.total}
                sub={Object.entries(preview.raport.byStatus)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              />
              <StatCard
                label="Insiden"
                value={preview.insiden.telatBerulang.length + preview.insiden.belumTerassign.length}
                sub={`${preview.insiden.telatBerulang.length} telat berulang · ${preview.insiden.belumTerassign.length} belum terassign`}
              />
            </div>
          )}

          {!aiConfigured ? (
            <div className="p-4 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200">
              AI service belum dikonfigurasi di server (Gemini API key belum tersedia).
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {generating ? "Menyusun ringkasan..." : "Generate Ringkasan AI"}
              </button>
              {generating && (
                <span className="text-sm text-gray-400 animate-pulse">
                  AI menganalisis data institusi...
                </span>
              )}
            </div>
          )}

          {generating && streamText && !result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-400 mb-2">Streaming hasil AI...</div>
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{streamText}</pre>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-2">Ringkasan Eksekutif</h2>
                <p className="text-sm text-gray-700 leading-relaxed">{result.ringkasan_eksekutif}</p>
              </div>

              {result.poin_positif.length > 0 && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                  <h3 className="font-semibold text-green-800 text-sm mb-2">Capaian Positif</h3>
                  <ul className="space-y-1.5">
                    {result.poin_positif.map((p, i) => (
                      <li key={i} className="text-sm text-green-700 flex gap-2">
                        <span>•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.area_perhatian.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                  <h3 className="font-semibold text-amber-800 text-sm mb-2">Area Perhatian</h3>
                  <ul className="space-y-1.5">
                    {result.area_perhatian.map((p, i) => (
                      <li key={i} className="text-sm text-amber-700 flex gap-2">
                        <span>•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.rekomendasi.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Rekomendasi Tindakan</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {result.rekomendasi.map((r, i) => (
                      <div key={i} className="px-5 py-4">
                        <div className="font-medium text-gray-900 text-sm">
                          {i + 1}. {r.judul}
                        </div>
                        {r.detail && <p className="mt-1 text-sm text-gray-600">{r.detail}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}