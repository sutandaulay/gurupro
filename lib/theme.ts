"use client";

export type TemaPreference = "light" | "dark" | "system";

const PREFS_KEY = "gurupro_user_preferences";
export const THEME_CHANGED_EVENT = "gurupro_theme_changed";

export function getSavedTema(): TemaPreference {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.tema === "dark" || parsed?.tema === "light" || parsed?.tema === "system") {
        return parsed.tema;
      }
    }
  } catch {
    // ignore
  }
  return "light";
}

export function saveTema(tema: TemaPreference) {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed.tema = tema;
    localStorage.setItem(PREFS_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function isSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTema(tema: TemaPreference) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark =
    tema === "dark" || (tema === "system" && isSystemDark());
  root.classList.remove("dark", "light");
  if (dark) {
    root.classList.add("dark");
    document.body.classList.add("dark");
  } else {
    root.classList.add("light");
    document.body.classList.remove("dark");
  }
}

export function applySavedTema() {
  applyTema(getSavedTema());
}

export function setTema(tema: TemaPreference) {
  saveTema(tema);
  applyTema(tema);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: tema }));
  }
}

export function nextTema(tema: TemaPreference): TemaPreference {
  if (tema === "light") return "dark";
  if (tema === "dark") return "system";
  return "light";
}
