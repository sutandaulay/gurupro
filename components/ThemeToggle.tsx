"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon, IconDeviceLaptop } from "@tabler/icons-react";
import { getSavedTema, setTema, applySavedTema, type TemaPreference } from "@/lib/theme";

const OPTIONS: { value: TemaPreference; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Terang", icon: <IconSun size={15} /> },
  { value: "dark", label: "Gelap", icon: <IconMoon size={15} /> },
  { value: "system", label: "Sistem", icon: <IconDeviceLaptop size={15} /> },
];

interface ThemeToggleProps {
  variant?: "icon" | "segmented";
  className?: string;
}

export default function ThemeToggle({ variant = "segmented", className = "" }: ThemeToggleProps) {
  const [tema, setTemaState] = useState<TemaPreference>("light");

  useEffect(() => {
    setTemaState(getSavedTema());
    applySavedTema();
  }, []);

  const handleChange = (value: TemaPreference) => {
    setTemaState(value);
    setTema(value);
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => handleChange(tema === "dark" ? "light" : "dark")}
        className={`p-2 rounded-lg hover:bg-gray-100 text-gray-600 cursor-pointer ${className}`}
        aria-label="Ganti tema"
        title={tema === "dark" ? "Ganti ke Terang" : "Ganti ke Gelap"}
      >
        {tema === "dark" ? <IconSun size={20} /> : <IconMoon size={20} />}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 border border-slate-200 ${className}`}
      role="group"
      aria-label="Pilih tema"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleChange(opt.value)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            tema === opt.value
              ? "bg-white text-violet-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
          aria-pressed={tema === opt.value}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
