"use client";

import { useState, useEffect } from "react";
import { IconAlertTriangle, IconCheck, IconLoader2, IconSettings } from "@tabler/icons-react";

type JalurRegulasi = "kemendikdasmen" | "kemenag";
type UrutanSiswa = "abjad_nama" | "nomor_absen" | "nisn";
type UrutanKolom = "nilai_angka" | "deskripsi" | "predikat" | "kkm";

const JALUR_OPTIONS: { value: JalurRegulasi; label: string }[] = [
  { value: "kemendikdasmen", label: "Kemendikdasmen" },
  { value: "kemenag", label: "Kemenag" },
];

const URUTAN_SISWA_OPTIONS: { value: UrutanSiswa; label: string }[] = [
  { value: "abjad_nama", label: "Abjad Nama" },
  { value: "nomor_absen", label: "Nomor Absen" },
  { value: "nisn", label: "NISN" },
];

const KOLOM_OPTIONS: { value: UrutanKolom; label: string; desc: string }[] = [
  { value: "nilai_angka", label: "Nilai Angka", desc: "Nilai akhir siswa" },
  { value: "deskripsi", label: "Deskripsi", desc: "Deskripsi capaian" },
  { value: "predikat", label: "Predikat", desc: "Tuntas/Belum Tuntas" },
  { value: "kkm", label: "KKM", desc: "KKM mata pelajaran" },
];

interface PemetaanKolomSettingsProps {
  sekolahId: string;
}

export default function PemetaanKolomSettings({ sekolahId }: PemetaanKolomSettingsProps) {
  const [jalurRegulasi, setJalurRegulasi] = useState<JalurRegulasi>("kemendikdasmen");
  const [urutanSiswa, setUrutanSiswa] = useState<UrutanSiswa>("abjad_nama");
  const [urutanKolom, setUrutanKolom] = useState<UrutanKolom[]>(["nilai_angka", "deskripsi", "predikat", "kkm"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expiredWarning, setExpiredWarning] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [jalurRegulasi, sekolahId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/raport/pemetaan-kolom?sekolahId=${sekolahId}&jalurRegulasi=${jalurRegulasi}`
      );
      const result = await res.json();
      if (res.ok && result.profile) {
        setUrutanSiswa(result.profile.urutanSiswa);
        setUrutanKolom(result.profile.urutanKolom);
        setExpiredWarning(result.expired);
      } else {
        setUrutanSiswa("abjad_nama");
        setUrutanKolom(["nilai_angka", "deskripsi", "predikat", "kkm"]);
        setExpiredWarning(false);
      }
    } catch {
      setMessage({ type: "error", text: "Gagal memuat profil pemetaan kolom" });
    } finally {
      setLoading(false);
    }
  };

  const toggleKolom = (kolom: UrutanKolom) => {
    setUrutanKolom((prev) =>
      prev.includes(kolom) ? prev.filter((k) => k !== kolom) : [...prev, kolom]
    );
  };

  const moveKolom = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= urutanKolom.length) return;
    const copy = [...urutanKolom];
    [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
    setUrutanKolom(copy);
  };

  const handleSave = async () => {
    if (urutanKolom.length === 0) {
      setMessage({ type: "error", text: "Pilih minimal 1 kolom" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/raport/pemetaan-kolom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sekolahId,
          jalurRegulasi,
          urutanSiswa,
          urutanKolom,
          systemVersionCatatan: `v${Date.now()}`,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal menyimpan");
      }

      setExpiredWarning(false);
      setMessage({ type: "success", text: "Profil pemetaan kolom berhasil disimpan" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <IconLoader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
        <IconSettings size={20} className="text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Pemetaan Kolom Ekspor Excel</h2>
      </div>

      {expiredWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <IconAlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Profil pemetaan kolom sudah lebih dari 1 tahun — cek ulang urutan kolom sebelum ekspor.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Jalur Regulasi
        </label>
        <div className="flex gap-3">
          {JALUR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setJalurRegulasi(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                jalurRegulasi === opt.value
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Urutan Siswa
        </label>
        <select
          value={urutanSiswa}
          onChange={(e) => setUrutanSiswa(e.target.value as UrutanSiswa)}
          className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
        >
          {URUTAN_SISWA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Urutan Kolom (urutkan sesuai format e-Rapor/RDM)
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Atur urutan dan pilih kolom yang akan muncul di file Excel.
        </p>
        <div className="space-y-2">
          {KOLOM_OPTIONS.map((kolom, index) => {
            const selected = urutanKolom.includes(kolom.value);
            const orderIndex = urutanKolom.indexOf(kolom.value);
            return (
              <div
                key={kolom.value}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selected
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-gray-200 bg-white opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleKolom(kolom.value)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{kolom.label}</p>
                  <p className="text-xs text-gray-500">{kolom.desc}</p>
                </div>
                {selected && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 mr-2">Urutan #{orderIndex + 1}</span>
                    <button
                      onClick={() => moveKolom(orderIndex, -1)}
                      disabled={orderIndex === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveKolom(orderIndex, 1)}
                      disabled={orderIndex === urutanKolom.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <IconCheck size={16} className="flex-shrink-0 mt-0.5" />
          ) : (
            <IconAlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          )}
          {message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || urutanKolom.length === 0}
        className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <IconLoader2 size={16} className="animate-spin" />
            Menyimpan...
          </span>
        ) : (
          "Simpan Pengaturan"
        )}
      </button>
    </div>
  );
}
