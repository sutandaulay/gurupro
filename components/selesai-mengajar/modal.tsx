"use client";
import { apiFetch } from "@/lib/api-client";

import React, { useState, useEffect } from 'react';
import {
  IconX,
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconClock,
  IconMapPin,
  IconUsers,
  IconSparkles,
  IconLoader2,
} from '@tabler/icons-react';
import type {
  ScheduleInfo,
  SelesaiMengajarResult,
} from '@/lib/selesai-mengajar/types';
import ProgressOverlay from './progress-overlay';
import VoiceTextInput from '@/components/voice/VoiceTextInput';
import HasilModal from './hasil-modal';
import { toLocalDateString } from '@/lib/utils';

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
  onSessionStarted?: (scheduleId: string, sessionId: string) => void;
}

type ModalStep = 'select' | 'guru' | 'siswa' | 'selesai' | 'processing' | 'result';

function SelesaiMengajarModalContent({
  isOpen,
  onClose,
  preselectedSchedule,
  rppId,
  onComplete,
  onSessionStarted,
}: SelesaiMengajarModalProps) {
  const [step, setStep] = useState<ModalStep>(preselectedSchedule ? 'guru' : 'select');
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleInfo | null>(
    preselectedSchedule || null
  );
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Presensi Guru
  const [teacherLocation, setTeacherLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Step 2: Presensi Siswa
  const [students, setStudents] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentAttendance, setStudentAttendance] = useState<{ [studentId: string]: { status: string; catatan: string } }>({});

  // Step 3: Selesai
  const [topik, setTopik] = useState('');
  const [catatan, setCatatan] = useState('');
  const [saveJournal, setSaveJournal] = useState(true);

  // Processing
  const [progress, setProgress] = useState<StepProgress[]>([]);
  const [result, setResult] = useState<SelesaiMengajarResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = async () => {
    try {
      const response = await apiFetch('/api/selesai-mengajar');
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
        if (data.schedules?.length === 1) {
          setSelectedSchedule(data.schedules[0]);
          setStep('guru');
        }
      } else {
        const data = await response.json().catch(() => null);
        if (response.status === 403 && data?.error === 'expired') {
          setError('expired');
        }
      }
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  };

  useEffect(() => {
    if (isOpen) fetchSchedules();
  }, [isOpen]);

  // Fetch students when entering siswa step
  useEffect(() => {
    if (step === 'siswa' && selectedSchedule?.class_id) {
      fetchStudents();
    }
  }, [step, selectedSchedule?.class_id]);

  const handleSelectSchedule = (schedule: ScheduleInfo) => {
    setSelectedSchedule(schedule);
    setStep('guru');
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation tidak didukung browser ini');
      return;
    }
    setIsGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTeacherLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setIsGettingLocation(false);
      },
      (err) => {
        setLocationError(err.message);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Auto-capture lokasi saat masuk step presensi guru
  useEffect(() => {
    if (step === 'guru' && !teacherLocation && !isGettingLocation && navigator.geolocation) {
      getLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handlePresensiGuru = async () => {
    if (!selectedSchedule) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/attendance/teaching/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchedule.school_id,
          subjectId: selectedSchedule.subject_id,
          classId: selectedSchedule.class_id,
          latitude: teacherLocation?.lat ?? 0,
          longitude: teacherLocation?.lng ?? 0,
          accuracy: teacherLocation?.accuracy ?? 0,
        }),
      });

      const data = await res.json();
      let sessionId = data.session?.id;

      // Kalau sudah ada active session, gunakan session ID yang sudah ada
      if (!res.ok) {
        if (data.activeSessionId) {
          sessionId = data.activeSessionId;
        } else {
          throw new Error(data.error || 'Gagal memulai presensi guru');
        }
      }

      (selectedSchedule as any)._sessionId = sessionId;
      setStep('siswa');
      onSessionStarted?.(selectedSchedule.id, sessionId);

      // Mark session as active in sessionStorage so FAB knows
      if (selectedSchedule.id && typeof window !== 'undefined') {
        sessionStorage.setItem(`teaching_session_${selectedSchedule.id}`, 'active');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!selectedSchedule?.class_id) return;
    setIsLoadingStudents(true);
    try {
      const res = await apiFetch(`/api/students?class_id=${selectedSchedule.class_id}&limit=100`);
      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      setStudents(list);
      const initial: { [id: string]: { status: string; catatan: string } } = {};
      list.forEach((s: any) => {
        initial[s.id] = { status: 'Hadir', catatan: '' };
      });
      setStudentAttendance(initial);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handlePresensiSelesai = () => {
    setStep('selesai');
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

    const steps: StepProgress[] = [
      { step: 'jurnal', status: 'pending', message: '' },
      { step: 'absensi', status: 'pending', message: '' },
      { step: 'atp', status: 'pending', message: '' },
      { step: 'memory', status: 'pending', message: '' },
      { step: 'next', status: 'pending', message: '' },
    ];
    setProgress(steps);

    const hadir = Object.values(studentAttendance).filter((a) => a.status === 'Hadir').length;
    const izin = Object.values(studentAttendance).filter((a) => a.status === 'Izin').length;
    const sakit = Object.values(studentAttendance).filter((a) => a.status === 'Sakit').length;
    const alpha = Object.values(studentAttendance).filter((a) => a.status === 'Alpha').length;

    const studentIds = Object.entries(studentAttendance)
      .filter(([, att]) => att.status === 'Hadir')
      .map(([id]) => id);

    const student_attendance = Object.entries(studentAttendance).map(([studentId, att]) => ({
      studentId,
      status: att.status,
      catatan: att.catatan || '',
    }));

    const input = {
      guru_id: (selectedSchedule as any).teacher_id || '',
      kelas_id: selectedSchedule.class_id,
      kelas_nama: selectedSchedule.class_name || '',
      mapel_id: selectedSchedule.subject_id,
      mapel_nama: selectedSchedule.subject_name || '',
      tanggal: toLocalDateString(),
      jam_mulai: selectedSchedule.jam_mulai,
      jam_selesai: selectedSchedule.jam_selesai,
      topik_diajarkan: topik || '',
      jumlah_hadir: hadir,
      jumlah_izin: izin,
      jumlah_sakit: sakit,
      jumlah_alpha: alpha,
      student_ids: studentIds,
      student_attendance,
      catatan_tambahan: catatan || '',
      schedule_id: selectedSchedule.id,
      school_id: selectedSchedule.school_id,
    };

    let abortController: AbortController | null = null;

    try {
      abortController = new AbortController();
      const response = await apiFetch('/api/selesai-mengajar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal menyelesaikan mengajar');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          let event: any;
          try {
            event = JSON.parse(line.slice(6));
          } catch (parseError: any) {
            console.error('Failed to parse SSE event:', line, parseError.message);
            continue;
          }

          if (event.step === 'complete' && event.data) {
            setResult(event.data);
            setProgress(steps.map((s) => ({ ...s, status: 'done' as const })));
            setStep('result');
            if (selectedSchedule?.id && typeof window !== 'undefined') {
              sessionStorage.removeItem(`teaching_session_${selectedSchedule.id}`);
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('selesaiMengajarDone', {
                detail: { scheduleId: selectedSchedule?.id },
              }));
            }
            onComplete?.(event.data);
          } else if (event.step === 'error') {
            setError(event.message || 'Terjadi kesalahan');
            setStep('selesai');
          } else if (['jurnal', 'absensi', 'atp', 'memory', 'next'].includes(event.step)) {
            setProgress((prev) =>
              prev.map((p) =>
                p.step === event.step
                  ? { ...p, status: event.status || 'done', message: event.message || '', data: event.data }
                  : p
              )
            );
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStep('selesai');
      } else {
        setError(err.message || 'Terjadi kesalahan');
        setStep('selesai');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 'processing') return;
    onClose();
  };

  if (!isOpen) return null;

  if (error === 'expired') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 text-center animate-modal-in space-y-4">
          <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto">🔒</div>
          <h3 className="text-base font-black text-slate-800">Akses Presensi Mengajar Terkunci</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Fitur Presensi Mengajar dinonaktifkan karena masa aktif langganan PRO Anda telah berakhir. Silakan perpanjang paket Anda.
          </p>
          <div className="flex gap-3 pt-2">
            <button onClick={handleClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer">
              Tutup
            </button>
            <button onClick={() => window.location.assign("/dashboard?perpanjang=true")} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl cursor-pointer">
              Perpanjang Premium
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step: Select Schedule ---
  if (step === 'select') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-modal-in">
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <IconCheck className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Mulai Mengajar</h2>
                  <p className="text-xs text-white/80">Pilih kelas yang akan diajarkan</p>
                </div>
              </div>
              <button onClick={handleClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center">
                <IconX className="text-white" size={18} />
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {schedules.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">Tidak ada jadwal mengajar hari ini</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">Pilih jadwal yang akan dimulai:</p>
                <div className="space-y-3">
                  {schedules.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSchedule(s)}
                      className="w-full p-4 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-2xl transition-all text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">{s.subject_name}</div>
                          <div className="text-sm text-slate-500">{s.class_name}</div>
                          {s.school_name && (
                            <div className="text-xs text-indigo-500 mt-0.5">{s.school_name}</div>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                            <IconClock size={12} />
                            <span>{s.jam_mulai} - {s.jam_selesai}</span>
                          </div>
                        </div>
                        <IconChevronRight size={20} className="text-slate-300 group-hover:text-violet-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Step: Presensi Guru ---
  if (step === 'guru' && selectedSchedule) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-modal-in">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <IconCheck className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">1. Presensi Guru</h2>
                  <p className="text-xs text-white/80">
                    {selectedSchedule.subject_name} — {selectedSchedule.class_name}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center">
                <IconX className="text-white" size={18} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Info jadwal */}
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
              <IconClock size={16} />
              <span>{selectedSchedule.jam_mulai} - {selectedSchedule.jam_selesai}</span>
              {teacherLocation && (
                <span className="ml-auto text-emerald-600 text-xs font-medium flex items-center gap-1">
                  <IconMapPin size={12} /> Lokasi tertangkap
                </span>
              )}
            </div>

            {/* Lokasi */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">
                Lokasi Mengajar
              </label>
              <button
                onClick={getLocation}
                disabled={isGettingLocation}
                className={`w-full py-3 border rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  teacherLocation
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600'
                }`}
              >
                {isGettingLocation ? (
                  <><IconLoader2 size={16} className="animate-spin" /><span>Mendapatkan lokasi...</span></>
                ) : teacherLocation ? (
                  <><IconMapPin size={16} /><span>Lokasi tertangkap (akurasi {Math.round(teacherLocation.accuracy)}m)</span></>
                ) : (
                  <><IconMapPin size={16} /><span>Tangkap Lokasi Sekarang</span></>
                )}
              </button>
              {locationError && (
                <p className="text-xs text-rose-500 mt-1">{locationError}</p>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                Lokasi digunakan untuk validasi mengajar di sekolah
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <button
              onClick={handlePresensiGuru}
              disabled={isLoading || !teacherLocation}
              className={`w-full py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${
                isLoading || !teacherLocation
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
              }`}
            >
              {isLoading ? (
                <><IconLoader2 size={18} className="animate-spin" /><span>Memproses...</span></>
              ) : (
                <><IconCheck size={18} /><span>PRESENSI GURU — MULAI MENGAJAR</span></>
              )}
            </button>

            <button onClick={() => setStep('select')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1">
              <IconChevronLeft size={16} />
              <span>Pilih jadwal lain</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step: Presensi Siswa ---
  if (step === 'siswa' && selectedSchedule) {
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0 };
    Object.values(studentAttendance).forEach((a) => { counts[a.status as keyof typeof counts]++; });

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-modal-in max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <IconUsers size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">2. Presensi Siswa</h2>
                  <p className="text-xs text-white/80">
                    {selectedSchedule.class_name} — {selectedSchedule.subject_name}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center">
                <IconX size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
            {['guru', 'siswa', 'selesai'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 ${s === 'siswa' ? 'text-violet-600' : 'text-slate-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    s === 'siswa' ? 'bg-violet-600 text-white' : s === 'guru' ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'
                  }`}>
                    {s === 'guru' ? <IconCheck size={10} /> : i + 1}
                  </div>
                  <span className="text-xs font-medium">
                    {s === 'guru' ? 'Guru' : s === 'siswa' ? 'Siswa' : 'Selesai'}
                  </span>
                </div>
                {i < 2 && <div className="flex-1 h-px bg-slate-200 mx-2" />}
              </React.Fragment>
            ))}
          </div>

          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {isLoadingStudents ? (
              <div className="text-center py-8">
                <IconLoader2 size={24} className="animate-spin text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Memuat daftar siswa...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">Tidak ada data siswa. Lanjut tanpa presensi siswa.</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-2">
                    <div className="text-emerald-700 text-lg">{counts.Hadir}</div>
                    <div className="text-emerald-600">Hadir</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl py-2">
                    <div className="text-amber-700 text-lg">{counts.Izin}</div>
                    <div className="text-amber-600">Izin</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl py-2">
                    <div className="text-orange-700 text-lg">{counts.Sakit}</div>
                    <div className="text-orange-600">Sakit</div>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl py-2">
                    <div className="text-rose-700 text-lg">{counts.Alpha}</div>
                    <div className="text-rose-600">Alpha</div>
                  </div>
                </div>

                {/* Student list */}
                <div className="space-y-1.5">
                  {students.map((student, idx) => {
                    const att = studentAttendance[student.id] || { status: 'Hadir', catatan: '' };
                    return (
                      <div key={student.id} className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl">
                        <span className="text-xs text-slate-400 w-5 shrink-0">{idx + 1}.</span>
                        <span className="text-sm font-medium text-slate-700 flex-1 min-w-0 truncate">
                          {student.nama_siswa || student.name || student.nama || `Siswa ${idx + 1}`}
                        </span>
                        {/* Ceklis buttons */}
                        <div className="flex gap-1">
                          {(['Hadir', 'Izin', 'Sakit', 'Alpha'] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => setStudentAttendance(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], status },
                              }))}
                              className={`w-8 h-7 text-[9px] font-bold rounded-lg transition-all ${
                                att.status === status
                                  ? status === 'Hadir' ? 'bg-emerald-500 text-white' :
                                    status === 'Izin' ? 'bg-amber-500 text-white' :
                                    status === 'Sakit' ? 'bg-orange-500 text-white' :
                                    'bg-rose-500 text-white'
                                  : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                              }`}
                            >
                              {status === 'Alpha' ? 'α' : status[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 shrink-0 space-y-2">
            <button
              onClick={handlePresensiSelesai}
              disabled={isLoadingStudents}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {isLoadingStudents ? (
                <><IconLoader2 size={18} className="animate-spin" /><span>Memuat...</span></>
              ) : (
                <><IconCheck size={18} /><span>Lanjut — Selesai Mengajar</span></>
              )}
            </button>
            <button onClick={() => setStep('guru')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1">
              <IconChevronLeft size={16} /><span>Kembali ke Presensi Guru</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step: Selesai Mengajar ---
  if (step === 'selesai' && selectedSchedule) {
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0 };
    Object.values(studentAttendance).forEach((a) => { counts[a.status as keyof typeof counts]++; });

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-modal-in max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <IconSparkles size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">3. Selesai Mengajar</h2>
                  <p className="text-xs text-white/80">
                    {selectedSchedule.subject_name} — {selectedSchedule.class_name}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center">
                <IconX size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
            {['guru', 'siswa', 'selesai'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 ${s === 'selesai' ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    s === 'selesai' ? 'bg-emerald-600 text-white' :
                    s === 'siswa' ? 'bg-violet-600 text-white' :
                    'bg-emerald-500 text-white'
                  }`}>
                    {s === 'guru' || s === 'siswa' ? <IconCheck size={10} /> : i + 1}
                  </div>
                  <span className="text-xs font-medium">
                    {s === 'guru' ? 'Guru' : s === 'siswa' ? 'Siswa' : 'Selesai'}
                  </span>
                </div>
                {i < 2 && <div className="flex-1 h-px bg-slate-200 mx-2" />}
              </React.Fragment>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {/* Ringkasan presensi */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Ringkasan Kehadiran</span>
                <button onClick={() => setStep('siswa')} className="text-xs text-violet-600 font-medium">
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-2">
                  <div className="text-lg font-bold text-emerald-700">{counts.Hadir}</div>
                  <div className="text-emerald-600">Hadir</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl py-2">
                  <div className="text-lg font-bold text-amber-700">{counts.Izin}</div>
                  <div className="text-amber-600">Izin</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl py-2">
                  <div className="text-lg font-bold text-orange-700">{counts.Sakit}</div>
                  <div className="text-orange-600">Sakit</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl py-2">
                  <div className="text-lg font-bold text-rose-700">{counts.Alpha}</div>
                  <div className="text-rose-600">Alpha</div>
                </div>
              </div>
            </div>

            {/* Topik */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">
                Topik yang diajarkan
              </label>
              <input
                type="text"
                value={topik}
                onChange={(e) => setTopik(e.target.value)}
                placeholder="Contoh: Persamaan Linear Satu Variabel"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none text-sm"
              />
            </div>

            {/* Opsi AI */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveJournal}
                  onChange={(e) => setSaveJournal(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Buat Jurnal Mengajar otomatis (AI)</span>
              </label>
            </div>

            {/* Catatan */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">
                Catatan (opsional)
              </label>
              <VoiceTextInput
                value={catatan}
                onChange={setCatatan}
                placeholder="Catatan khusus..."
                rows={2}
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleSelesai}
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              {isLoading ? (
                <><IconLoader2 size={18} className="animate-spin" /><span>Memproses...</span></>
              ) : (
                <><IconSparkles size={20} /><span>SELESAIKAN MENGAJAR</span></>
              )}
            </button>

            <button onClick={() => setStep('siswa')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1">
              <IconChevronLeft size={16} /><span>Kembali ke Presensi Siswa</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ProgressOverlay
        isOpen={step === 'processing'}
        progress={progress}
        percentage={calculateProgress()}
      />
      <HasilModal
        isOpen={step === 'result'}
        result={result}
        schedule={selectedSchedule}
        onClose={handleClose}
        onCreateRPP={() => { window.location.href = '/dashboard?module=rpp&new=true'; }}
        onViewJournal={() => { window.location.href = '/dashboard?module=jurnal'; }}
        autoCloseMs={10000}
      />
      <style jsx>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-in { animation: modal-in 0.3s ease-out; }
      `}</style>
    </>
  );
}

export default function SelesaiMengajarModal(props: SelesaiMengajarModalProps) {
  return props.isOpen ? <SelesaiMengajarModalContent {...props} /> : null;
}
