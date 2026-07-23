"use client";

import { useState, useRef, useEffect } from "react";

// Sprint 4.3 — Voice Input untuk Jurnal (Opsi A: Web Speech API, native browser, gratis).
// Komponen reusable: men-transkrip suara -> teks, lalu memanggil onChange.
// TIDAK mengubah Selesai Mengajar Pipeline; hanya mengisi field teks jurnal.
// Catatan: akurasi Bahasa Indonesia perlu dites di perangkat guru.

interface VoiceTextInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  disabled?: boolean;
}

export default function VoiceTextInput({
  value,
  onChange,
  placeholder,
  label,
  rows = 4,
  disabled,
}: VoiceTextInputProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "id-ID";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      // Gabungkan dengan teks yang sudah ada (jika ada)
      onChange(transcript.trim());
    };
    rec.onerror = (e: any) => {
      setError(e?.error === "not-allowed" ? "Izin mikrofon ditolak." : "Gagal mengenali suara.");
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
    };
  }, [onChange]);

  const toggle = () => {
    if (!supported || disabled) return;
    setError(null);
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setListening(true);
      } catch {
        setError("Tidak bisa memulai rekam suara.");
      }
    }
  };

  if (!supported) {
    // Fallback: textarea biasa tanpa tombol mic
    return (
      <div>
        {label && <label className="text-xs text-gray-600 mb-1 block">{label}</label>}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
    );
  }

  return (
    <div>
      {label && <label className="text-xs text-gray-600 mb-1 block">{label}</label>}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className="w-full px-3 py-2 pr-12 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          title={listening ? "Berhenti merekam" : "Isi dengan suara"}
          className={`absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            listening ? "bg-red-500 text-white animate-pulse" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
          }`}
        >
          {listening ? "■" : "🎤"}
        </button>
      </div>
      {listening && <p className="text-[11px] text-red-500 mt-1">Merekam… bicara dengan jelas ya.</p>}
      {error && <p className="text-[11px] text-amber-600 mt-1">{error}</p>}
    </div>
  );
}
