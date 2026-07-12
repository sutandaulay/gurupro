/**
 * ComplianceBadge Component
 *
 * Badge untuk menampilkan compliance checklist terhadap Permendikdasmen No. 1/2026
 * Bisa di-expand untuk lihat detail per poin
 */

"use client";

import { useState } from "react";
import { IconCheck, IconAlertTriangle, IconChevronDown, IconChevronUp } from "@tabler/icons-react";

interface ComplianceCheck {
  selarasCPTPATP?: { status: string; catatan: string };
  mendorongPembelajaranAktif?: { status: string; catatan: string };
  mencakupOlahPikirHatiRasaRaga?: { status: string; catatan: string };
  bahasaSesuaiFase?: { status: string; catatan: string };
  catatan?: string;
}

interface ComplianceBadgeProps {
  complianceCheck?: ComplianceCheck | null;
  className?: string;
}

export default function ComplianceBadge({
  complianceCheck,
  className = "",
}: ComplianceBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  // If no compliance check, show unknown
  if (!complianceCheck) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium ${className}`}
      >
        <span>?</span>
        <span>Compliance check belum tersedia</span>
      </div>
    );
  }

  // Determine overall compliance status
  const checks = [
    complianceCheck.selarasCPTPATP,
    complianceCheck.mendorongPembelajaranAktif,
    complianceCheck.mencakupOlahPikirHatiRasaRaga,
    complianceCheck.bahasaSesuaiFase,
  ];

  const compliantCount = checks.filter(
    (c) => c?.status === "compliant" || c?.status === "partial"
  ).length;
  const nonCompliantCount = checks.filter(
    (c) => c?.status === "non-compliant"
  ).length;
  const isFullyCompliant = nonCompliantCount === 0 && compliantCount === checks.filter(c => c).length;

  return (
    <div className={`${className}`}>
      {/* Main Badge */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:shadow-md ${
          isFullyCompliant
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : nonCompliantCount > 0
            ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {isFullyCompliant ? (
          <IconCheck size={14} className="text-green-600" />
        ) : nonCompliantCount > 0 ? (
          <IconAlertTriangle size={14} className="text-amber-600" />
        ) : (
          <span className="text-gray-500">?</span>
        )}
        <span>
          {isFullyCompliant
            ? "Sesuai Standar Permendikdasmen No. 1/2026"
            : nonCompliantCount > 0
            ? `${nonCompliantCount} poin perlu perbaikan`
            : "Compliance check dalam proses"}
        </span>
        {expanded ? (
          <IconChevronUp size={14} />
        ) : (
          <IconChevronDown size={14} />
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Detail Compliance Check:
          </p>
          <div className="space-y-2">
            <ComplianceItem
              label="Selaras CP/TP/ATP"
              check={complianceCheck.selarasCPTPATP}
            />
            <ComplianceItem
              label="Mendorong Pembelajaran Aktif"
              check={complianceCheck.mendorongPembelajaranAktif}
            />
            <ComplianceItem
              label="Mencakup 4 Dimensi OLAH"
              subtitle="Olah Pikir, Hati, Rasa, Raga"
              check={complianceCheck.mencakupOlahPikirHatiRasaRaga}
            />
            <ComplianceItem
              label="Bahasa Sesuai Fase"
              check={complianceCheck.bahasaSesuaiFase}
            />
          </div>
          {complianceCheck.catatan && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600">
                {complianceCheck.catatan}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ComplianceItem Component
// ============================================

interface ComplianceItemProps {
  label: string;
  subtitle?: string;
  check?: { status: string; catatan: string };
}

function ComplianceItem({ label, subtitle, check }: ComplianceItemProps) {
  if (!check) {
    return (
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <span className="text-gray-400 text-[10px]">-</span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">{label}</p>
          {subtitle && (
            <p className="text-[10px] text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  const isCompliant = check.status === "compliant" || check.status === "partial";
  const isNonCompliant = check.status === "non-compliant";

  return (
    <div className="flex items-start gap-2">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          isNonCompliant
            ? "bg-amber-100"
            : isCompliant
            ? "bg-green-100"
            : "bg-gray-100"
        }`}
      >
        {isNonCompliant ? (
          <IconAlertTriangle size={12} className="text-amber-600" />
        ) : isCompliant ? (
          <IconCheck size={12} className="text-green-600" />
        ) : (
          <span className="text-gray-400 text-[10px]">?</span>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`text-xs font-medium ${
              isNonCompliant ? "text-amber-700" : "text-gray-700"
            }`}
          >
            {label}
          </p>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              isNonCompliant
                ? "bg-amber-100 text-amber-700"
                : isCompliant
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {check.status === "compliant"
              ? "Compliant"
              : check.status === "partial"
              ? "Partial"
              : check.status === "non-compliant"
              ? "Non-compliant"
              : "Unknown"}
          </span>
        </div>
        {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        {check.catatan && (
          <p
            className={`text-[10px] mt-0.5 ${
              isNonCompliant ? "text-amber-600" : "text-gray-500"
            }`}
          >
            {check.catatan}
          </p>
        )}
      </div>
    </div>
  );
}
