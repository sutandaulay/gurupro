"use client";
import { apiFetch } from "@/lib/api-client";

import React, { useState, useEffect } from 'react';
import { IconCheck, IconClock, IconLoader2 } from '@tabler/icons-react';
import SelesaiMengajarModal from './modal';
import type { ScheduleInfo } from '@/lib/selesai-mengajar/types';

interface SelesaiMengajarFABProps {
  className?: string;
}

function isJamMengajar(
  schedules: ScheduleInfo[],
  currentTime: Date,
  marginMinutes: number = 30
): boolean {
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  for (const schedule of schedules) {
    const [startHour, startMin] = schedule.jam_mulai.split(':').map(Number);
    const [endHour, endMin] = schedule.jam_selesai.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin - marginMinutes;
    const endMinutes = endHour * 60 + endMin + marginMinutes;
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) return true;
  }
  return false;
}

function getScheduleState(
  schedules: ScheduleInfo[],
  allSchedules: any[]
): 'completed' | 'in_progress' | 'available' {
  if (!allSchedules || allSchedules.length === 0) return 'available';

  const incompleteSchedules = allSchedules.filter((s: any) => !s.isCompleted);
  if (incompleteSchedules.length === 0) return 'completed';

  // Check if any incomplete schedule has an active session
  // We track this via sessionStorage — if user started but didn't finish
  if (typeof window !== 'undefined') {
    const inProgress = incompleteSchedules.some((s: any) => {
      const key = `teaching_session_${s.id}`;
      return sessionStorage.getItem(key) === 'active';
    });
    if (inProgress) return 'in_progress';
  }

  return 'available';
}

export default function SelesaiMengajarFAB({ className = '' }: SelesaiMengajarFABProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleInfo | null>(null);
  const [state, setState] = useState<'completed' | 'in_progress' | 'available'>('available');
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!mounted) return;

    const fetchData = async () => {
      try {
        const response = await apiFetch('/api/selesai-mengajar');

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setSchedules([]);
            setIsVisible(false);
            return;
          }
          console.error(`[FAB] API error ${response.status}`);
          setSchedules([]);
          setIsVisible(false);
          return;
        }

        const data = await response.json();
        const all = data.allSchedules || [];
        setSchedules(data.schedules || []);
        setAllSchedules(all);

        const newState = getScheduleState(data.schedules || [], all);
        setState(newState);

        const now = new Date();
        const inJam = isJamMengajar(all, now, 30);
        setIsVisible(inJam && newState !== 'completed');

        const current = all.find((s: any) => isJamMengajar([s], now, 30));
        setCurrentSchedule(current || null);
      } catch (err) {
        console.error('[FAB] Failed to fetch schedules:', err);
        setSchedules([]);
        setIsVisible(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Don't render on server
  if (!mounted) return null;

  // Hide when completed
  if (!isVisible && !isModalOpen && state === 'completed') return null;

  const handleOpen = () => setIsModalOpen(true);
  const handleClose = () => setIsModalOpen(false);

  const handleComplete = () => {
    setState('completed');
    setIsVisible(false);
  };

  // Different labels per state
  const labelMap = {
    completed: 'Administration Selesai',
    in_progress: 'Lanjutkan',
    available: 'Mulai Mengajar',
  };

  const colorMap = {
    completed: 'from-emerald-500 to-green-600',
    in_progress: 'from-amber-500 to-orange-500',
    available: 'from-violet-500 to-purple-600',
  };

  const subtitleMap = {
    completed: 'Tap untuk detail',
    in_progress: currentSchedule
      ? `${currentSchedule.class_name} - ${currentSchedule.jam_mulai}`
      : 'Sedang berlangsung',
    available: currentSchedule
      ? `${currentSchedule.class_name} - ${currentSchedule.jam_mulai}`
      : 'Waktu mengajar aktif',
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl transition-all duration-300 group ${
          state === 'completed'
            ? 'bg-gradient-to-r from-emerald-500 to-green-600'
            : state === 'in_progress'
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse'
            : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:shadow-lg'
        } ${className}`}
        style={{ animation: isVisible ? 'fab-in 0.5s ease-out' : undefined }}
      >
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          {state === 'completed' ? (
            <IconCheck size={22} className="text-white" />
          ) : state === 'in_progress' ? (
            <IconLoader2 size={22} className="text-white animate-spin" />
          ) : (
            <IconClock size={22} className="text-white" />
          )}
        </div>
        <div className="text-left">
          <div className="font-bold text-white text-sm leading-tight">
            {labelMap[state]}
          </div>
          <div className="text-[10px] text-white/80 leading-tight mt-0.5">
            {subtitleMap[state]}
          </div>
        </div>
      </button>

      <SelesaiMengajarModal
        isOpen={isModalOpen}
        onClose={handleClose}
        preselectedSchedule={currentSchedule || undefined}
        onComplete={handleComplete}
      />

      <style jsx>{`
        @keyframes fab-in {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
