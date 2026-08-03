"use client";

import ThemeToggle from "@/components/ThemeToggle";

export default function AdminThemeToggle() {
  return (
    <div className="fixed bottom-5 right-5 z-50 bg-white border border-slate-200 rounded-full shadow-lg px-2 py-1.5">
      <ThemeToggle variant="segmented" />
    </div>
  );
}
