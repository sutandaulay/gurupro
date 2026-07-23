"use client";

import { useState, useEffect } from "react";

// Sprint 4.4 — Pop-up ringan Well-Being Check-In (maksimal 2 tap, sekali seminggu).
// Tidak mengganggu alur kerja utama. Data agregat anonim ke pimpinan.

const PERTANYAAN = [
  { key: "beban_kerja", label: "Seberapa berat beban kerja Anda minggu ini?", emoji: "💼" },
  { key: "dukungan", label: "Seberapa terbantu Anda oleh GuruPRO & sekolah?", emoji: "🤝" },
];

export default function WellBeingCheckIn() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const lastShown = localStorage.getItem("wellbeing_last_week");

    fetch("/api/well-being/checkin", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const serverWeek = data.week;
        if (!serverWeek) {
          setDone(true);
          return;
        }

        if (lastShown === serverWeek) {
          setDone(true);
          return;
        }

        if (data.alreadyFilled) {
          localStorage.setItem("wellbeing_last_week", serverWeek);
          setDone(true);
        } else {
          const t = setTimeout(() => setOpen(true), 1500);
          return () => clearTimeout(t);
        }
      })
      .catch(() => setDone(true));
  }, []);

  const pick = (val: number) => {
    const key = PERTANYAAN[step].key;
    setAnswers((a) => ({ ...a, [key]: val }));
    if (step < PERTANYAAN.length - 1) {
      setStep(step + 1);
    } else {
      submit();
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/well-being/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.week) {
          localStorage.setItem("wellbeing_last_week", data.week);
        }
      }
    } catch {
      /* abaikan */
    } finally {
      setOpen(false);
      setDone(true);
    }
  };

  if (done || !open) return null;

  const q = PERTANYAAN[step];

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <p className="text-white font-bold text-sm">Check-in Mingguan</p>
          </div>
          <button onClick={() => { setOpen(false); setDone(true); }} className="text-white/80 hover:text-white text-sm">
            Lewati
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-400 mb-1">Pertanyaan {step + 1} dari {PERTANYAAN.length}</p>
          <p className="text-sm font-semibold text-slate-800 mb-4">{q.label}</p>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => pick(v)}
                disabled={submitting}
                className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                  answers[q.key] === v
                    ? "border-pink-500 bg-pink-50 text-pink-600"
                    : "border-slate-200 hover:border-pink-300 text-slate-600"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3 text-center">
            Jawaban Anda diringkas anonim untuk pimpinan sekolah.
          </p>
        </div>
      </div>
    </div>
  );
}
