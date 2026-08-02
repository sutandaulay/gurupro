"use client";

import React, { useEffect, useRef } from 'react';
import {
  IconX,
  IconCheck,
  IconBook,
  IconUsers,
  IconChartBar,
  IconBrain,
  IconArrowRight,
  IconSparkles,
} from '@tabler/icons-react';
import type { SelesaiMengajarResult, ScheduleInfo } from '@/lib/selesai-mengajar/types';

interface HasilModalProps {
  isOpen: boolean;
  result: SelesaiMengajarResult | null;
  schedule: ScheduleInfo | null;
  onClose: () => void;
  onCreateRPP?: () => void;
  onViewJournal?: () => void;
  autoCloseMs?: number;
}

const STEP_RESULTS = [
  {
    key: 'jurnal',
    label: 'Jurnal mengajar',
    icon: IconBook,
    color: 'indigo',
    getMessage: (result: SelesaiMengajarResult) =>
      result.jurnal
        ? `Materi: ${result.jurnal.materi_pembelajaran.substring(0, 40)}...`
        : 'Lewati',
  },
  {
    key: 'absensi',
    label: 'Kehadiran',
    icon: IconUsers,
    color: 'emerald',
    getMessage: (result: SelesaiMengajarResult) =>
      `${result.absensi_summary?.hadir ?? 0} siswa hadir`,
  },
  {
    key: 'atp',
    label: 'Progress ATP',
    icon: IconChartBar,
    color: 'amber',
    getMessage: (result: SelesaiMengajarResult) =>
      result.atp_updated
        ? `Minggu ke-${result.atp_updated.progress_minggu}`
        : 'Tidak ada ATP',
  },
  {
    key: 'memory',
    label: 'Lesson memory',
    icon: IconBrain,
    color: 'purple',
    getMessage: () => 'Diperbarui',
  },
  {
    key: 'next',
    label: 'Materi berikutnya',
    icon: IconArrowRight,
    color: 'rose',
    getMessage: (result: SelesaiMengajarResult) =>
      result.next_materi?.topik_berikutnya || 'Tidak tersedia',
  },
];

const colorClasses = {
  indigo: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-600',
    icon: 'text-indigo-500',
    border: 'border-indigo-200',
  },
  emerald: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
    icon: 'text-emerald-500',
    border: 'border-emerald-200',
  },
  amber: {
    bg: 'bg-amber-100',
    text: 'text-amber-600',
    icon: 'text-amber-500',
    border: 'border-amber-200',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    icon: 'text-purple-500',
    border: 'border-purple-200',
  },
  rose: {
    bg: 'bg-rose-100',
    text: 'text-rose-600',
    icon: 'text-rose-500',
    border: 'border-rose-200',
  },
};

export default function HasilModal({
  isOpen,
  result,
  schedule,
  onClose,
  onCreateRPP,
  onViewJournal,
  autoCloseMs = 10000,
}: HasilModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Confetti effect
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Confetti particles
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      rotation: number;
      rotationSpeed: number;
      life: number;
    }> = [];

    const colors = ['#8B5CF6', '#A78BFA', '#C4B5FD', '#F59E0B', '#FBBF24', '#34D399', '#10B981'];

    // Create particles
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 1,
      });
    }

    // Animation
    let frameCount = 0;
    const maxFrames = 180; // 3 seconds at 60fps

    function animate() {
      if (!ctx) return;

      if (frameCount > maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        // Update
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // Gravity
        p.rotation += p.rotationSpeed;
        p.life -= 0.005;

        // Draw
        if (p.life > 0 && ctx) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      }

      frameCount++;
      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isOpen]);

  // Auto-close
  useEffect(() => {
    if (!isOpen || !autoCloseMs) return;

    const timer = setTimeout(() => {
      onClose();
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [isOpen, autoCloseMs, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Confetti Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-[150] pointer-events-none"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Content */}
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-modal-bounce">
          {/* Header with celebration */}
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-bounce">
                <IconSparkles className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  🎉 Administrasi Selesai!
                </h2>
                <p className="text-sm text-white/80">
                  Semua tugas mengajar telah diselesaikan
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Schedule Info */}
            {schedule && (
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="text-sm font-bold text-slate-700">
                  {schedule.subject_name} • {schedule.class_name}
                </div>
                {schedule.school_name && (
                  <div className="text-xs text-indigo-500 font-medium mt-0.5">
                    {schedule.school_name}
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-1">
                  {schedule.jam_mulai} - {schedule.jam_selesai}
                </div>
              </div>
            )}

            {/* Results List */}
            {result && (
              <div className="space-y-3">
                {STEP_RESULTS.map((step, index) => {
                  const colors =
                    colorClasses[step.color as keyof typeof colorClasses];
                  const Icon = step.icon;
                  const message = step.getMessage(result);
                  const hasData =
                    step.key === 'jurnal'
                      ? result.jurnal
                      : step.key === 'absensi'
                      ? true
                      : step.key === 'atp'
                      ? result.atp_updated
                      : step.key === 'memory'
                      ? result.memory_updated
                      : result.next_materi;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${colors.border} ${colors.bg} animate-fade-in`}
                      style={{ animationDelay: `${index * 150}ms` }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                        <Icon className={colors.icon} size={16} />
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${colors.text}`}>
                          ✓ {step.label}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 truncate">
                          {message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Next Materi Suggestion */}
            {result?.next_materi && (
              <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconArrowRight className="text-violet-600" size={16} />
                  <span className="text-sm font-semibold text-violet-700">
                    Pertemuan Berikutnya
                  </span>
                </div>
                <div className="text-sm font-medium text-violet-800">
                  {result.next_materi.topik_berikutnya}
                </div>
                {result.next_materi.sub_materi && (
                  <div className="text-xs text-violet-600 mt-1">
                    {result.next_materi.sub_materi}
                  </div>
                )}
                {result.next_materi.perlu_remedial && (
                  <div className="mt-2 px-2 py-1 bg-amber-100 rounded-lg inline-block">
                    <span className="text-xs font-medium text-amber-700">
                      ⚠️ Perlu remedial
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {onCreateRPP && (
                <button
                  onClick={onCreateRPP}
                  className="py-3 px-4 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <IconSparkles size={16} />
                  <span className="text-sm">Buat RPP</span>
                </button>
              )}
              {onViewJournal && (
                <button
                  onClick={onViewJournal}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <IconBook size={16} />
                  <span className="text-sm">Lihat Jurnal</span>
                </button>
              )}
              <button
                onClick={onClose}
                className={`${
                  onCreateRPP || onViewJournal ? 'col-span-2' : ''
                } py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors`}
              >
                Tutup
              </button>
            </div>

            {/* Auto-close notice */}
            <p className="text-xs text-center text-slate-400">
              Modal akan menutup otomatis dalam 10 detik
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes modal-bounce {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          50% {
            transform: scale(1.02) translateY(-5px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-bounce {
          animation: modal-bounce 0.5s ease-out;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </>
  );
}