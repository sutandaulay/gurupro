"use client";

import { IconBrandWhatsapp } from "@tabler/icons-react";

export interface FloatingWhatsAppProps {
  phoneNumber?: string;
  message?: string;
  label?: string;
}

export default function FloatingWhatsApp({
  phoneNumber = "6281283960337",
  message = "Halo saya ingin bertanya tentang GuruPRO",
  label = "Hubungi Kami",
}: FloatingWhatsAppProps) {
  const waUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2"
      >
        <span className="absolute left-16 top-1/2 -translate-y-1/2 bg-white text-neutral-700 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg border border-neutral-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          {label}
        </span>
        <div className="w-14 h-14 bg-success-500 hover:bg-success-600 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-success-400/40 hover:scale-105 transition-all duration-300">
          <IconBrandWhatsapp size={28} />
        </div>
      </a>
    </div>
  );
}
