"use client";
import { apiFetch } from "@/lib/api-client";

import React, { useState, useEffect } from "react";
import {
  IconX,
  IconCheck,
  IconLoader2,
  IconAlertCircle,
  IconBook,
  IconUsers,
  IconClipboardCheck,
  IconMessage,
  IconArrowRight,
  IconSparkles,
} from "@tabler/icons-react";

interface AttendanceRecord {
  student_id: string;
  student_name: string;
  status: string;
  catatan?: string;
}

interface ScheduleInfo {
  id: string;
  class_id: string;
  subject_id: string;
  school_id: string;
  class_name: string;
  subject_name: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface SelesaiMengajarModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: ScheduleInfo;
  attendanceData?: AttendanceRecord[];
  onComplete?: (result: any) => void;
}

type Step = "confirm" | "generating" | "preview" | "complete";

interface GeneratedContent {
  journal?: any;
  reflection?: string;
  followup?: string;
}

function SelesaiMengajarModalContent({
  isOpen,
  onClose,
  schedule,
  attendanceData = [],
  onComplete,
}: SelesaiMengajarModalProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [materiInput, setMateriInput] = useState("");
  const [catatanGuru, setCatatanGuru] = useState("");
  const [saveJournal, setSaveJournal] = useState(true);
  const [generateReflection, setGenerateReflection] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({});

  if (!isOpen) return null;

  // Count attendance
  const hadirCount = attendanceData.filter((a) => a.status === "Hadir").length;
  const tidakHadirCount = attendanceData.filter((a) => a.status !== "Hadir").length;
  const izinCount = attendanceData.filter((a) => a.status === "Izin").length;
  const sakitCount = attendanceData.filter((a) => a.status === "Sakit").length;
  const alpaCount = attendanceData.filter((a) => a.status === "Alpa").length;

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setStep("generating");

    const steps = [
      { text: "Menyimpan absensi...", progress: 10 },
      { text: "Membuat jurnal mengajar...", progress: 40 },
      { text: "Membuat refleksi diri...", progress: 70 },
      { text: "Menyusun rencana tindak lanjut...", progress: 90 },
      { text: "Menyelesaikan...", progress: 100 },
    ];

    try {
      // Animate progress
      for (const s of steps) {
        setProgress(s.text);
        // Simulate progress animation
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Call API to complete teaching session
      const response = await apiFetch("/api/teaching-session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_id: schedule?.id,
          class_id: schedule?.class_id,
          subject_id: schedule?.subject_id,
          school_id: schedule?.school_id,
          attendance_data: attendanceData,
          materi_input: materiInput,
          catatan_guru: catatanGuru,
          save_journal: saveJournal,
          generate_reflection: generateReflection,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal menyelesaikan mengajar");
      }

      setGeneratedContent({
        journal: result.results?.journal,
        reflection: result.results?.reflection,
      });

      setStep("preview");
      onComplete?.(result);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setStep("confirm");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setStep("complete");
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <IconSparkles className="text-white" size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Selesaikan Mengajar
                </h2>
                <p className="text-xs text-white/80">
                  AI otomatis lengkapi administrasi
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition"
            >
              <IconX className="text-white" size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Confirm */}
          {step === "confirm" && (
            <div className="space-y-5">
              {/* Summary Card */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <IconBook size={16} className="text-indigo-500" />
                  <span className="font-semibold text-slate-700">
                    {schedule?.subject_name || "Mata Pelajaran"}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">
                    Kelas {schedule?.class_name || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>🕐</span>
                  <span>
                    {schedule?.jam_mulai} - {schedule?.jam_selesai}
                  </span>
                </div>
              </div>

              {/* Attendance Summary */}
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <IconUsers size={16} className="text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-700">
                    Kehadiran Siswa
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-emerald-100 rounded-xl py-2 px-1">
                    <div className="text-lg font-bold text-emerald-700">
                      {hadirCount}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-medium">
                      Hadir
                    </div>
                  </div>
                  <div className="bg-amber-100 rounded-xl py-2 px-1">
                    <div className="text-lg font-bold text-amber-700">
                      {izinCount + sakitCount}
                    </div>
                    <div className="text-[10px] text-amber-600 font-medium">
                      Izin/Sakit
                    </div>
                  </div>
                  <div className="bg-rose-100 rounded-xl py-2 px-1">
                    <div className="text-lg font-bold text-rose-700">
                      {alpaCount}
                    </div>
                    <div className="text-[10px] text-rose-600 font-medium">
                      Alpa
                    </div>
                  </div>
                  <div className="bg-slate-100 rounded-xl py-2 px-1">
                    <div className="text-lg font-bold text-slate-600">
                      {attendanceData.length}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      Total
                    </div>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="saveJournal"
                    checked={saveJournal}
                    onChange={(e) => setSaveJournal(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="saveJournal"
                    className="text-sm text-slate-700 cursor-pointer"
                  >
                    Buat Jurnal Mengajar otomatis
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="generateReflection"
                    checked={generateReflection}
                    onChange={(e) => setGenerateReflection(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="generateReflection"
                    className="text-sm text-slate-700 cursor-pointer"
                  >
                    Generate Refleksi Diri
                  </label>
                </div>
              </div>

              {/* Materi Input */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Materi yang Diajarkan (opsional)
                </label>
                <textarea
                  value={materiInput}
                  onChange={(e) => setMateriInput(e.target.value)}
                  placeholder="Contoh: Bab 3.1 - Operasi Hitung Pecahan"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-none resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Semakin detail, semakin akurat hasil AI
                </p>
              </div>

              {/* Catatan */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Catatan Guru (opsional)
                </label>
                <textarea
                  value={catatanGuru}
                  onChange={(e) => setCatatanGuru(e.target.value)}
                  placeholder="Catatan khusus tentang pembelajaran hari ini..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-none resize-none"
                />
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                  <IconAlertCircle className="text-rose-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-rose-700">{error}</p>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                {isLoading ? (
                  <>
                    <IconLoader2 className="animate-spin" size={18} />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <IconSparkles size={18} />
                    <span>Selesaikan & Generate AI</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Generating */}
          {step === "generating" && (
            <div className="py-8 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-emerald-200 rounded-full" />
                <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <IconSparkles className="text-emerald-500" size={28} />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800">
                  AI Sedang Bekerja...
                </h3>
                <p className="text-sm text-slate-500">{progress}</p>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <IconCheck size={20} />
                <span className="font-bold">Berhasil Dibuat!</span>
              </div>

              {/* Generated Summary */}
              <div className="space-y-3">
                {generatedContent.journal && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconClipboardCheck size={16} className="text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">
                        Jurnal Mengajar
                      </span>
                    </div>
                    <div className="text-xs text-emerald-700 space-y-1">
                      <p>
                        <strong>Materi:</strong>{" "}
                        {generatedContent.journal.materi_pembelajaran}
                      </p>
                      <p>
                        <strong>Status:</strong> Draft
                      </p>
                    </div>
                  </div>
                )}

                {generatedContent.reflection && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconMessage size={16} className="text-indigo-600" />
                      <span className="text-sm font-semibold text-indigo-800">
                        Refleksi Diri
                      </span>
                    </div>
                    <p className="text-xs text-indigo-700 line-clamp-3">
                      {typeof generatedContent.reflection === "string"
                        ? generatedContent.reflection.substring(0, 150) + "..."
                        : "Refleksi berhasil di-generate"}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  ⚡ Anda bisa mengedit hasil AI sebelum disimpan secara resmi.
                  Buka menu Jurnal untuk revisi.
                </p>
              </div>

              <button
                onClick={handleSave}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <IconCheck size={18} />
                <span>Selesai</span>
              </button>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === "complete" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <IconCheck className="text-emerald-500" size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  administrasi Selesai!
                </h3>
                <p className="text-sm text-slate-500">
                  Semua administrasi mengajar telah dilengkapi
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-in {
          animation: modal-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function SelesaiMengajarModal(props: SelesaiMengajarModalProps) {
  return props.isOpen ? <SelesaiMengajarModalContent {...props} /> : null;
}