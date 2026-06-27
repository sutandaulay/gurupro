"use client";

import { useState, useEffect } from "react";
import { IconCapRounded, IconX } from "@tabler/icons-react";

const STORAGE_KEY = "gurupro_pwa_dismissed";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === "true") return;

    const timer = setTimeout(() => {
      setShow(true);
    }, 30000);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!show) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transform transition-transform duration-300 ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center gap-4 px-5 py-4 max-w-3xl mx-auto">
        <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <IconCapRounded size={32} stroke={1.5} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Install GuruPRO</p>
          <p className="text-xs text-gray-500">
            Akses lebih cepat tanpa buka browser
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
        >
          Install Sekarang
        </button>
        <button
          onClick={handleDismiss}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label="Tutup"
        >
          <IconX size={18} stroke={1.5} />
        </button>
      </div>
    </div>
  );
}
