"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";

interface SchoolHeader {
  nama_sekolah: string;
  alamat: string;
  npsn: string;
  nama_kepala_sekolah: string;
  nip_kepala_sekolah: string;
  academic_year_active: string;
}

interface SuratResult {
  nomor_surat: string;
  lampiran: string;
  perihal: string;
  tanggal: string;
  kepada: string;
  pembuka: string;
  isi: string[];
  penutup: string;
  tembusan: string[];
  penandatangan: string;
  nip: string;
}

const JENIS_SURAT = [
  { value: "dinas", label: "Surat Dinas" },
  { value: "undangan", label: "Undangan Rapat" },
  { value: "edaran", label: "Surat Edaran" },
  { value: "tugas", label: "Surat Tugas" },
  { value: "pemberitahuan", label: "Surat Pemberitahuan" },
];

export default function AiSuratContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;

  const [school, setSchool] = useState<SchoolHeader | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<SuratResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    jenis: "dinas",
    perihal: "",
    tujuan: "",
    catatan: "",
  });

  const loadInit = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institution/${institutionId}/ai-surat`);
      const data = await res.json();
      if (res.ok) {
        setFeatureEnabled(Boolean(data.featureEnabled));
        setAiConfigured(data.aiConfigured !== false);
        setSchool(data.school || null);
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
    loadInit();
  }, [loadInit]);

  const handleGenerate = async () => {
    if (!institutionId || generating) return;
    if (!form.perihal.trim()) {
      setError("Perihal surat wajib diisi");
      return;
    }
    setError("");
    setGenerating(true);
    setResult(null);
    setStreamText("");
    try {
      const res = await fetch(`/api/institution/${institutionId}/ai-surat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      setError(err.message || "Gagal generate draf surat");
    } finally {
      setGenerating(false);
    }
  };

  const buildSuratText = (r: SuratResult) => {
    const parts: string[] = [];
    if (school) {
      parts.push(school.nama_sekolah.toUpperCase());
      parts.push(school.alamat || "");
      parts.push(`NPSN: ${school.npsn || "-"}`);
      parts.push("");
    }
    parts.push(`Nomor: ${r.nomor_surat}`);
    parts.push(`Lampiran: ${r.lampiran}`);
    parts.push(`Perihal: ${r.perihal}`);
    parts.push("");
    parts.push(r.tanggal || "");
    parts.push("");
    parts.push(r.kepada ? `Kepada Yth.\n${r.kepada}` : "");
    parts.push("");
    if (r.pembuka) parts.push(r.pembuka);
    parts.push(...(r.isi || []));
    if (r.penutup) parts.push(r.penutup);
    parts.push("");
    parts.push("Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.");
    parts.push("");
    if (r.tembusan && r.tembusan.length > 0) {
      parts.push("Tembusan:");
      parts.push(...r.tembusan);
      parts.push("");
    }
    parts.push(r.penandatangan || school?.nama_kepala_sekolah || "Kepala Sekolah");
    if (r.nip && r.nip !== "-") parts.push(`NIP. ${r.nip}`);
    return parts.join("\n");
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildSuratText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Draf Surat AI</h1>
        <p className="text-sm text-gray-500">
          Generate draf surat dinas/edaran untuk Kepala Sekolah &amp; Wakasek
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
          Fitur Draf Surat AI belum aktif untuk institusi ini. Aktifkan fitur Command Center lewat pengaturan institusi.
        </div>
      ) : (
        <>
          {/* Kop surat preview */}
          {school && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="text-lg font-bold text-gray-900 uppercase">
                {school.nama_sekolah}
              </div>
              <div className="text-sm text-gray-500">{school.alamat}</div>
              <div className="text-xs text-gray-400">NPSN: {school.npsn || "-"}</div>
            </div>
          )}

          {/* Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Detail Surat</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Jenis Surat</label>
                <select
                  value={form.jenis}
                  onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  {JENIS_SURAT.map((j) => (
                    <option key={j.value} value={j.value}>
                      {j.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perihal *</label>
                <input
                  value={form.perihal}
                  onChange={(e) => setForm((f) => ({ ...f, perihal: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="cth: Undangan Rapat Dinas Bulanan"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Kepada / Tujuan
                </label>
                <input
                  value={form.tujuan}
                  onChange={(e) => setForm((f) => ({ ...f, tujuan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="cth: Bapak/Ibu Guru dan Tenaga Kependidikan"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Catatan / Poin Isi
                </label>
                <textarea
                  value={form.catatan}
                  onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  rows={3}
                  placeholder="Poin-poin yang perlu dicantumkan di isi surat..."
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {generating ? "Menyusun draf..." : "Generate Draf Surat"}
              </button>
              {!aiConfigured && (
                <span className="text-sm text-amber-600">
                  AI belum dikonfigurasi (Gemini API key belum tersedia).
                </span>
              )}
            </div>
          </div>

          {generating && streamText && !result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-400 mb-2">Streaming hasil AI...</div>
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{streamText}</pre>
            </div>
          )}

          {result && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Draf Surat</h2>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  {copied ? "Tersalin" : "Salin"}
                </button>
              </div>
              <div className="px-5 py-6">
                <pre className="whitespace-pre-wrap font-serif text-sm text-gray-800 leading-relaxed">
                  {buildSuratText(result)}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}