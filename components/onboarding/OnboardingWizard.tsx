"use client";

import { useState, useEffect } from "react";

const steps = [
  {
    id: "welcome",
    title: "Selamat Datang di GuruPRO! 🎉",
    description:
      "Kami akan memandu Anda menyiapkan data sekolah dalam beberapa langkah mudah. Siapkan informasi berikut:",
    checklist: [
      "Nama Sekolah & NPSN (jika ada)",
      "Daftar Kelas",
      "Daftar Mata Pelajaran",
      "Daftar Siswa (bisa diisi nanti)",
    ],
  },
  {
    id: "tahun-ajaran",
    title: "Buat Tahun Ajaran",
    description: "Tahun ajaran adalah dasar dari semua aktivitas mengajar Anda. Buat tahun ajaran aktif terlebih dahulu.",
    hint: "Contoh: 2024/2025, umumnya mulai Juli dan berakhir Juni tahun berikutnya.",
  },
  {
    id: "sekolah",
    title: "Isi Profil Sekolah",
    description: "Masukkan informasi sekolah Anda. NPSN bersifat opsional — bisa dikosongkan jika tidak tahu.",
    hint: "Jika sekolah Anda sudah terdaftar di GuruPRO sebagai institusi, masukkan NPSN yang sama untuk terhubung secara otomatis.",
  },
  {
    id: "kelas-mapel",
    title: "Tambah Kelas & Mata Pelajaran",
    description: "Tambahkan kelas yang Anda ajar dan mata pelajaran yang Anda ampu.",
    hint: "Anda bisa menambahkan lebih banyak nanti kapan saja.",
  },
  {
    id: "siswa",
    title: "Input Data Siswa",
    description: "Masukkan daftar siswa per kelas. Anda bisa input manual satu per satu atau impor dari file CSV.",
    hint: "Ini bisa dilewati dulu — Anda bisa mengisi data siswa nanti.",
  },
  {
    id: "selesai",
    title: "Siap Memulai! 🚀",
    description:
      "Data dasar sudah siap. Anda sekarang bisa mulai menggunakan semua fitur GuruPRO:",
    checklist: [
      "Buat RPP & administrasi mengajar",
      "Catat jurnal mengajar harian",
      "Input nilai & buat raport",
      "Gunakan AI untuk generate soal",
    ],
  },
];

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
  }, [dismissed]);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (isFirst) return;
    setCurrentStep((prev) => prev - 1);
  };

  const handleSkipAll = () => {
    onSkip();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Progress Bar */}
        <div className="h-1.5 bg-slate-100 rounded-t-3xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-5 pb-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Langkah {currentStep + 1} dari {steps.length}
            </span>
            <button
              onClick={handleSkipAll}
              className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              Lewati Semua
            </button>
          </div>
          <div className="flex gap-1">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  idx <= currentStep ? "bg-primary-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Step Image/Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-50 to-purple-50 border border-primary-100 flex items-center justify-center text-2xl mb-5 mx-auto">
            {step.id === "welcome" && "👋"}
            {step.id === "tahun-ajaran" && "📅"}
            {step.id === "sekolah" && "🏫"}
            {step.id === "kelas-mapel" && "📚"}
            {step.id === "siswa" && "👨‍🎓"}
            {step.id === "selesai" && "🚀"}
          </div>

          <h3 className="text-xl font-black text-slate-900 text-center mb-2">{step.title}</h3>
          <p className="text-sm text-slate-500 text-center leading-relaxed mb-5">{step.description}</p>

          {step.hint && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <span className="font-bold">💡 Tips: </span>
                {step.hint}
              </p>
            </div>
          )}

          {step.checklist && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2.5">
              {step.checklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions for specific steps */}
          {step.id === "tahun-ajaran" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`, nama: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}` },
                { label: `${new Date().getFullYear() + 1}/${new Date().getFullYear() + 2}`, nama: `${new Date().getFullYear() + 1}/${new Date().getFullYear() + 2}` },
              ].map((preset) => (
                <button
                  key={preset.label}
                  className="px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-[10px] font-bold text-primary-700 hover:bg-primary-100 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            {!isFirst ? (
              <button
                onClick={handlePrev}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                ← Sebelumnya
              </button>
            ) : (
              <div />
            )}
          </div>
          <button
            onClick={handleNext}
            className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-200 transition"
          >
            {isLast ? "Mulai Menggunakan GuruPRO! 🚀" : "Lanjutkan →"}
          </button>
        </div>
      </div>
    </div>
  );
}
