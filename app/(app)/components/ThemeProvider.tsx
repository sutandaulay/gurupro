"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for when used outside ThemeProvider (e.g. in tests)
    return {
      theme: "light",
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return ctx;
}

const THEME_COOKIE = "theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);

  // Update viewport theme-color meta tag dynamically
  const metaThemeColor = document.querySelector("meta[name='theme-color']");
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      theme === "dark" ? "#1e293b" : "#7C3AED"
    );
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Server-side initial theme (read from cookie in layout.tsx) */
  initialTheme?: Theme;
}

export default function ThemeProvider({
  children,
  initialTheme,
}: ThemeProviderProps) {
  // Initialize from cookie or server-provided value
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return initialTheme ?? "light";
    const cookie = readCookie(THEME_COOKIE) as Theme | null;
    return cookie === "dark" || cookie === "light" ? cookie : initialTheme ?? "light";
  });

  // Apply theme to DOM and persist to cookie
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    writeCookie(THEME_COOKIE, next, COOKIE_MAX_AGE);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // On mount: apply the current theme to the DOM
  // (server already sets data-theme on <html>, but client needs to ensure it's set)
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
