"use client";

import React from "react";
import { getGradientForLabel, categoryThemes, type MenuCategory } from "@/lib/iconTheme";

export interface AppIconProps {
  label: string;
  size?: number;
  iconSize?: number;
  className?: string;
  active?: boolean;
  category?: MenuCategory;
  icon?: React.ReactNode;
  fallbackGradient?: [string, string];
}

export default function AppIcon({
  label,
  size = 56,
  iconSize = 26,
  className = "",
  active = false,
  category,
  icon,
  fallbackGradient,
}: AppIconProps) {
  const gradient = category
    ? categoryThemes[category].gradient
    : fallbackGradient || getGradientForLabel(label) || ["#7C3AED", "#5B21B6"];

  const [top, bottom] = gradient;
  const radius = 16;

  const baseShadow =
    "0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)";
  const activeShadow = active
    ? "0 0 0 3px rgba(124,58,237,0.25), 0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)"
    : baseShadow;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`,
        boxShadow: activeShadow,
        transition: "transform 150ms ease, box-shadow 150ms ease",
      }}
    >
      {icon && (
        <div
          style={{
            color: "white",
            width: iconSize,
            height: iconSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}
