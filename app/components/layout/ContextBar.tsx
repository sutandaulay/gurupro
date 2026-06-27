"use client";

import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface ContextBarProps {
  breadcrumbs: Breadcrumb[];
  actions?: React.ReactNode;
}

export default function ContextBar({ breadcrumbs, actions }: ContextBarProps) {
  return (
    <div className="h-11 bg-gray-50 border-b border-gray-100 px-6 flex items-center justify-between">
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          const Icon = IconChevronRight;
          return (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && (
                <Icon size={14} stroke={1.5} className="text-gray-300" />
              )}
              {isLast || !crumb.href ? (
                <span
                  className={
                    isLast
                      ? "font-semibold text-gray-900"
                      : "text-gray-500"
                  }
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-gray-500 hover:text-violet-600 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
