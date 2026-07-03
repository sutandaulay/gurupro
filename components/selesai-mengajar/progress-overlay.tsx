"use client";

import React from 'react';
import {
  IconLoader2,
  IconCheck,
  IconX,
  IconBook,
  IconUsers,
  IconChartBar,
  IconBrain,
  IconArrowRight,
} from '@tabler/icons-react';

interface StepProgress {
  step: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  message: string;
  data?: any;
}

interface ProgressOverlayProps {
  isOpen: boolean;
  progress: StepProgress[];
  percentage: number;
  onCancel?: () => void;
}

const STEP_CONFIG = {
  jurnal: {
    label: 'Jurnal Mengajar',
    icon: IconBook,
    color: 'indigo',
  },
  absensi: {
    label: 'Kehadiran Siswa',
    icon: IconUsers,
    color: 'emerald',
  },
  atp: {
    label: 'Progress ATP',
    icon: IconChartBar,
    color: 'amber',
  },
  memory: {
    label: 'Lesson Memory',
    icon: IconBrain,
    color: 'purple',
  },
  next: {
    label: 'Materi Berikutnya',
    icon: IconArrowRight,
    color: 'rose',
  },
};

const colorClasses = {
  indigo: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-600',
    icon: 'text-indigo-500',
    ring: 'ring-indigo-200',
  },
  emerald: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
    icon: 'text-emerald-500',
    ring: 'ring-emerald-200',
  },
  amber: {
    bg: 'bg-amber-100',
    text: 'text-amber-600',
    icon: 'text-amber-500',
    ring: 'ring-amber-200',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    icon: 'text-purple-500',
    ring: 'ring-purple-200',
  },
  rose: {
    bg: 'bg-rose-100',
    text: 'text-rose-600',
    icon: 'text-rose-500',
    ring: 'ring-rose-200',
  },
};

export default function ProgressOverlay({
  isOpen,
  progress,
  percentage,
  onCancel,
}: ProgressOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
              <IconLoader2 className="text-white animate-spin" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Sedang Menyelesaikan...
              </h2>
              <p className="text-xs text-white/80">
                Biasanya selesai dalam 5-10 detik
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="p-6 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 font-medium">
                Progress
              </span>
              <span className="text-violet-600 font-bold">{percentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            {progress.map((item, index) => {
              const config = STEP_CONFIG[item.step as keyof typeof STEP_CONFIG];
              if (!config) return null;

              const colors = colorClasses[config.color as keyof typeof colorClasses];
              const Icon = config.icon;

              return (
                <div
                  key={item.step}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                    item.status === 'loading'
                      ? 'bg-slate-50'
                      : item.status === 'done'
                      ? colors.bg
                      : item.status === 'error'
                      ? 'bg-rose-50'
                      : 'bg-slate-50/50'
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {/* Status Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      item.status === 'loading'
                        ? 'bg-violet-100'
                        : item.status === 'done'
                        ? 'bg-white'
                        : item.status === 'error'
                        ? 'bg-rose-200'
                        : 'bg-slate-100'
                    }`}
                  >
                    {item.status === 'loading' && (
                      <IconLoader2
                        className={`${colors.icon} animate-spin`}
                        size={16}
                      />
                    )}
                    {item.status === 'done' && (
                      <IconCheck className={colors.icon} size={16} />
                    )}
                    {item.status === 'error' && (
                      <IconX className="text-rose-500" size={16} />
                    )}
                    {item.status === 'pending' && (
                      <Icon className="text-slate-300" size={16} />
                    )}
                  </div>

                  {/* Step Info */}
                  <div className="flex-1">
                    <div
                      className={`text-sm font-medium ${
                        item.status === 'pending'
                          ? 'text-slate-400'
                          : item.status === 'done'
                          ? colors.text
                          : item.status === 'error'
                          ? 'text-rose-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {config.label}
                    </div>
                    {item.message && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.message}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  {item.status === 'done' && (
                    <span className={`text-xs font-medium ${colors.text}`}>
                      ✓
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="text-xs font-medium text-rose-500">
                      ✗
                    </span>
                  )}
                  {item.status === 'loading' && (
                    <span className="text-xs font-medium text-violet-500">
                      ...
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cancel Button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batalkan
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(139, 92, 246, 0);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s infinite;
        }
      `}</style>
    </div>
  );
}