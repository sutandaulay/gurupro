"use client";

import React, { useState, useEffect } from 'react';
import {
  IconX,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconBook,
  IconUsers,
  IconPlus,
  IconMinus,
  IconSparkles,
} from '@tabler/icons-react';
import type {
  ScheduleInfo,
  AttendanceSummary,
  SelesaiMengajarResult,
} from '@/lib/selesai-mengajar/types';
import ProgressOverlay from './progress-overlay';
import HasilModal from './hasil-modal';

interface StepProgress {
  step: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  message: string;
  data?: any;
}

interface SelesaiMengajarModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSchedule?: ScheduleInfo;
  rppId?: string;
  onComplete?: (result: SelesaiMengajarResult) => void;
}

type ModalStep = 'select' | 'input' | 'processing' | 'result';

export default function SelesaiMengajarModal({
  isOpen,
  onClose,
  preselectedSchedule,
  rppId,
  onComplete,
}: SelesaiMengajarModalProps) {
  // State
  const [step, setStep] = useState<ModalStep>('select');
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleInfo | null>(
    preselectedSchedule || null
  );
  const [isLoading, setIsLoading] = useState(false);

  // Input state
  const [topik, setTopik] = useState('');
  const [attendance, setAttendance] = useState<AttendanceSummary>({
    hadir: 32,
    izin: 0,
    sakit: 0,
    alpha: 0,
    total: 32,
  });
  const [catatan, setCatatan] = useState('');

  // Processing state
  const [progress, setProgress] = useState<StepProgress[]>([]);
  const [result, setResult] = useState<SelesaiMengajarResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load schedules on mount
  useEffect(() => {
    if (isOpen) {
      fetchSchedules();
      // If preselected or only 1 schedule, skip to input
      if (preselectedSchedule) {
        setSelectedSchedule(preselectedSchedule);
        setStep('input');
      }
    }
  }, [isOpen, preselectedSchedule]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setSelectedSchedule(null);
      setTopik('');
      setAttendance({ hadir: 32, izin: 0, sakit: 0, alpha: 0, total: 32 });
      setCatatan('');
      setProgress([]);
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/selesai-mengajar');
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
        // If only 1 schedule, auto-select
        if (data.schedules?.length === 1) {
          setSelectedSchedule(data.schedules[0]);
          setStep('input');
        }
      }
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  };

  const handleSelectSchedule = (schedule: ScheduleInfo) => {
    setSelectedSchedule(schedule);
    setStep('input');
  };

  const updateAttendance = (
    type: 'hadir' | 'izin' | 'sakit' | 'alpha',
    delta: number
  ) => {
    setAttendance((prev) => {
      const newValue = Math.max(0, prev[type] + delta);
      const newTotal = newValue + prev.izin + prev.sakit + prev.alpha;
      return {
        ...prev,
        [type]: newValue,
        total: newValue + prev.izin + prev.sakit + prev.alpha,
      };
    });
  };

  const calculateProgress = (): number => {
    if (progress.length === 0) return 0;
    const doneCount = progress.filter((p) => p.status === 'done').length;
    return Math.round((doneCount / 5) * 100);
  };

  const handleSelesai = async () => {
    if (!selectedSchedule) return;

    setIsLoading(true);
    setStep('processing');
    setError(null);
    setProgress([]);

    // Initialize progress steps
    const steps: StepProgress[] = [
      { step: 'jurnal', status: 'pending', message: '' },
      { step: 'absensi', status: 'pending', message: '' },
      { step: 'atp', status: 'pending', message: '' },
      { step: 'memory', status: 'pending', message: '' },
      { step: 'next', status: 'pending', message: '' },
    ];
    setProgress(steps);

    try {
      const response = await fetch('/api/selesai-mengajar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas_id: selectedSchedule.class_id,
          kelas_nama: selectedSchedule.class_name,
          mapel_id: selectedSchedule.subject_id,
          mapel_nama: selectedSchedule.subject_name,
          tanggal: new Date().toISOString().split('T')[0],
          jam_mulai: selectedSchedule.jam_mulai,
          jam_selesai: selectedSchedule.jam_selesai,
          topik_diajarkan: topik,
          jumlah_hadir: attendance.hadir,
          jumlah_izin: attendance.izin,
          jumlah_sakit: attendance.sakit,
          jumlah_alpha: attendance.alpha,
          catatan_tambahan: catatan,
          rpp_id: rppId,
          school_id: selectedSchedule.school_id,
          schedule_id: selectedSchedule.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal memproses');
      }

      // Read SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const event = JSON.parse(line.slice(6));

            // Update progress
            if (['jurnal', 'absensi', 'atp', 'memory', 'next'].includes(event.step)) {
              setProgress((prev) =>
                prev.map((p) =>
                  p.step === event.step
                    ? {
                        ...p,
                        status: event.status || 'done',
                        message: event.message || '',
                        data: event.data,
                      }
                    : p
                )
              );
            }

            // Complete
            if (event.step === 'complete') {
              setResult(event.data);
              setStep('result');
              setIsLoading(false);
              onComplete?.(event.data);
            }

            // Error
            if (event.step === 'error') {
              throw new Error(event.message);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
      setStep('input');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 'processing') return; // Prevent closing during processing
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Step 1: Select Schedule */}
      {step === 'select' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-modal-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <IconCheck className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Selesai Mengajar
                    </h2>
                    <p className="text-xs text-white/80">
                      Pilih kelas yang akan diselesaikan
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center"
                >
                  <IconX className="text-white" size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500">
                    Tidak ada jadwal mengajar hari ini
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    Selesai mengajar kelas mana?
                  </p>

                  <div className="space-y-3">
                    {schedules.map((schedule) => (
                      <button
                        key={schedule.id}
                        onClick={() => handleSelectSchedule(schedule)}
                        className="w-full p-4 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-2xl transition-all text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-800">
                              {schedule.subject_name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {schedule.class_name}
                            </div>
                            <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                              <IconClock size={12} />
                              <span>
                                {schedule.jam_mulai} - {schedule.jam_selesai}
                              </span>
                            </div>
                          </div>
                          <IconChevronRight
                            size={20}
                            className="text-slate-300 group-hover:text-violet-500 transition-colors"
                          />
                        </div>
                      </button>
                    ))}
                  </div>

                  <button className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2">
                    <span>Pilih kelas lain</span>
                    <IconChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Input Quick */}
      {step === 'input' && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-modal-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <IconCheck className="text-white" size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {selectedSchedule.subject_name}
                    </h2>
                    <p className="text-xs text-white/80">
                      {selectedSchedule.class_name} •{' '}
                      {new Date().toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center"
                >
                  <IconX className="text-white" size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Time Info */}
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
                <IconClock size={16} />
                <span>
                  {selectedSchedule.jam_mulai} - {selectedSchedule.jam_selesai}
                </span>
              </div>

              {/* Topik Input */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">
                  Topik yang diajarkan hari ini
                </label>
                <input
                  type="text"
                  value={topik}
                  onChange={(e) => setTopik(e.target.value)}
                  placeholder="Contoh: Persamaan Linear Satu Variabel"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none text-sm"
                />
              </div>

              {/* Attendance */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">
                  <IconUsers size={16} className="inline mr-1" />
                  Kehadiran Siswa
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {/* Hadir */}
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <button
                        onClick={() => updateAttendance('hadir', -1)}
                        className="w-6 h-6 bg-emerald-200 hover:bg-emerald-300 rounded-full flex items-center justify-center"
                      >
                        <IconMinus size={12} />
                      </button>
                      <button
                        onClick={() => updateAttendance('hadir', 1)}
                        className="w-6 h-6 bg-emerald-200 hover:bg-emerald-300 rounded-full flex items-center justify-center"
                      >
                        <IconPlus size={12} />
                      </button>
                    </div>
                    <div className="text-2xl font-bold text-emerald-700">
                      {attendance.hadir}
                    </div>
                    <div className="text-xs text-emerald-600">Hadir</div>
                  </div>

                  {/* Izin */}
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <button
                        onClick={() => updateAttendance('izin', -1)}
                        className="w-6 h-6 bg-amber-200 hover:bg-amber-300 rounded-full flex items-center justify-center"
                      >
                        <IconMinus size={12} />
                      </button>
                      <button
                        onClick={() => updateAttendance('izin', 1)}
                        className="w-6 h-6 bg-amber-200 hover:bg-amber-300 rounded-full flex items-center justify-center"
                      >
                        <IconPlus size={12} />
                      </button>
                    </div>
                    <div className="text-2xl font-bold text-amber-700">
                      {attendance.izin}
                    </div>
                    <div className="text-xs text-amber-600">Izin</div>
                  </div>

                  {/* Sakit */}
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <button
                        onClick={() => updateAttendance('sakit', -1)}
                        className="w-6 h-6 bg-orange-200 hover:bg-orange-300 rounded-full flex items-center justify-center"
                      >
                        <IconMinus size={12} />
                      </button>
                      <button
                        onClick={() => updateAttendance('sakit', 1)}
                        className="w-6 h-6 bg-orange-200 hover:bg-orange-300 rounded-full flex items-center justify-center"
                      >
                        <IconPlus size={12} />
                      </button>
                    </div>
                    <div className="text-2xl font-bold text-orange-700">
                      {attendance.sakit}
                    </div>
                    <div className="text-xs text-orange-600">Sakit</div>
                  </div>

                  {/* Alpha */}
                  <div className="bg-rose-50 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <button
                        onClick={() => updateAttendance('alpha', -1)}
                        className="w-6 h-6 bg-rose-200 hover:bg-rose-300 rounded-full flex items-center justify-center"
                      >
                        <IconMinus size={12} />
                      </button>
                      <button
                        onClick={() => updateAttendance('alpha', 1)}
                        className="w-6 h-6 bg-rose-200 hover:bg-rose-300 rounded-full flex items-center justify-center"
                      >
                        <IconPlus size={12} />
                      </button>
                    </div>
                    <div className="text-2xl font-bold text-rose-700">
                      {attendance.alpha}
                    </div>
                    <div className="text-xs text-rose-600">Alpha</div>
                  </div>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">
                  Catatan khusus (opsional)
                </label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: Ada siswa yang kesulitan soal no.3"
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none text-sm resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <p className="text-sm text-rose-700">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSelesai}
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <IconSparkles size={20} />
                    <span>SELESAIKAN SEMUA ADMINISTRASI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Processing - Progress Overlay */}
      <ProgressOverlay
        isOpen={step === 'processing'}
        progress={progress}
        percentage={calculateProgress()}
      />

      {/* Step 4: Result - Hasil Modal */}
      <HasilModal
        isOpen={step === 'result'}
        result={result}
        schedule={selectedSchedule}
        onClose={handleClose}
        onCreateRPP={() => {
          // Navigate to RPP creation
          window.location.href = '/dashboard?module=rpp&new=true';
        }}
        onViewJournal={() => {
          // Navigate to journal
          window.location.href = '/dashboard?module=jurnal';
        }}
        autoCloseMs={10000}
      />

      <style jsx>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-in {
          animation: modal-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}