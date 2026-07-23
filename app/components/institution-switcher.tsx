"use client";

import { useState, useEffect, useCallback } from "react";
import { IconBuilding, IconUser } from "@tabler/icons-react";

interface Institution {
  id: number;
  name: string;
}

type SwitcherState = {
  activeContext: 'individual' | { institutionId: number } | null;
  mode: string;
  institutions: Institution[];
};

export default function InstitutionSwitcher() {
  const [state, setState] = useState<SwitcherState | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/active-context');
      if (res.ok) {
        setState(await res.json());
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const handleChange = async (value: string) => {
    if (!state) return;

    let newContext: 'individual' | { institutionId: number };

    if (value === 'individual') {
      newContext = 'individual';
    } else {
      newContext = { institutionId: Number(value) };
    }

    const res = await fetch('/api/auth/active-context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeContext: newContext }),
    });

    if (res.ok) {
      setState((prev) => prev ? { ...prev, activeContext: newContext } : prev);
      setIsOpen(false);
      window.location.reload();
    }
  };

  if (!state) return null;

  if (state.mode === 'INDIVIDUAL_ONLY') return null;

  const currentInstitutionId =
    state.activeContext && state.activeContext !== 'individual'
      ? state.activeContext.institutionId
      : null;

  const activeInstitution = currentInstitutionId
    ? state.institutions.find((i) => i.id === currentInstitutionId)
    : null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm transition-colors cursor-pointer"
      >
        {activeInstitution ? (
          <>
            <IconBuilding size={16} stroke={1.5} className="text-violet-600 shrink-0" />
            <span className="text-gray-800 font-medium max-w-[140px] truncate">
              {activeInstitution.name}
            </span>
          </>
        ) : (
          <>
            <IconUser size={16} stroke={1.5} className="text-violet-600 shrink-0" />
            <span className="text-gray-800 font-medium">Ruang Kerja Pribadi</span>
          </>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-dropdown py-1 animate-fade-in">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Ruang Kerja
              </p>
            </div>

            <button
              onClick={() => handleChange('individual')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors cursor-pointer ${
                !currentInstitutionId ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-gray-700'
              }`}
            >
              <IconUser size={16} stroke={1.5} className="shrink-0" />
              <span>Ruang Kerja Pribadi</span>
              {!currentInstitutionId && (
                <span className="ml-auto">
                  <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>

            {state.institutions.length > 0 && (
              <>
                <div className="px-3 py-2 border-t border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Institusi
                  </p>
                </div>
                {state.institutions.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => handleChange(String(inst.id))}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors cursor-pointer ${
                      currentInstitutionId === inst.id
                        ? 'bg-violet-50 text-violet-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    <IconBuilding size={16} stroke={1.5} className="shrink-0" />
                    <span className="truncate">{inst.name}</span>
                    {currentInstitutionId === inst.id && (
                      <span className="ml-auto">
                        <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
                {currentInstitutionId && (
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <a
                      href={`/institusi/${currentInstitutionId}/dashboard`}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-violet-700 hover:bg-violet-50 transition-colors cursor-pointer font-medium"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 4a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      <span>Buka Dashboard Institusi</span>
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
