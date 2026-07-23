"use client";

import React, { useState, useEffect } from 'react';
import { IconCheck, IconX, IconClock } from '@tabler/icons-react';
import SelesaiMengajarModal from './modal';
import type { ScheduleInfo } from '@/lib/selesai-mengajar/types';

interface SelesaiMengajarFABProps {
  className?: string;
}

/**
 * Check if current time is within teaching hours
 * with a margin of ±30 minutes from schedule
 */
function isJamMengajar(
  schedules: ScheduleInfo[],
  currentTime: Date,
  marginMinutes: number = 30
): boolean {
  const currentMinutes =
    currentTime.getHours() * 60 + currentTime.getMinutes();

  for (const schedule of schedules) {
    const [startHour, startMin] = schedule.jam_mulai.split(':').map(Number);
    const [endHour, endMin] = schedule.jam_selesai.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin - marginMinutes;
    const endMinutes = endHour * 60 + endMin + marginMinutes;

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return true;
    }
  }

  return false;
}

export default function SelesaiMengajarFAB({ className = '' }: SelesaiMengajarFABProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleInfo | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!mounted) return;

    // Fetch schedules
    const fetchData = async () => {
      try {
        const response = await fetch('/api/selesai-mengajar');

        // Handle non-OK responses
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // Keep default error message if JSON parsing fails
          }

          if (response.status === 401) {
            // User not authenticated - hide the FAB
            setSchedules([]);
            setIsVisible(false);
            return;
          }
          if (response.status === 403) {
            // Subscription expired or other forbidden - hide the FAB
            setSchedules([]);
            setIsVisible(false);
            return;
          }

          // Server errors - log full details and hide FAB to avoid broken UI
          console.error(`[SelesaiMengajarFAB] API error ${response.status}:`, errorMessage);
          setSchedules([]);
          setIsVisible(false);
          return;
        }

        const data = await response.json();

        setSchedules(data.allSchedules || data.schedules || []);

        // Check if any session is completed today
        const hasCompleted = data.allSchedules?.some(
          (s: any) => s.isCompleted
        );
        setIsCompleted(hasCompleted || false);

        // Find current schedule based on time
        const now = new Date();
        const current = data.allSchedules?.find((s: ScheduleInfo) =>
          isJamMengajar([s], now, 30)
        );
        setCurrentSchedule(current || null);
      } catch (err) {
        console.error('[SelesaiMengajarFAB] Failed to fetch schedules:', err);
        setSchedules([]);
        setIsVisible(false);
      }
    };

    fetchData();

    // Check every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Update visibility based on teaching hours
  useEffect(() => {
    if (!mounted) return;

    const checkVisibility = () => {
      if (schedules.length === 0) {
        setIsVisible(false);
        return;
      }
      const now = new Date();
      const shouldShow = isJamMengajar(schedules, now, 30);
      setIsVisible(shouldShow && !isCompleted);
    };

    checkVisibility();
    const interval = setInterval(checkVisibility, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [mounted, schedules, isCompleted]);

  // Don't render anything on server
  if (!mounted) {
    return null;
  }

  // Hide if already completed or no schedules
  if (!isVisible && !isModalOpen) {
    return null;
  }

  const handleOpen = () => {
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  const handleComplete = () => {
    setIsCompleted(true);
    setIsVisible(false);
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={handleOpen}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl transition-all duration-300 group ${
          isCompleted
            ? 'bg-gradient-to-r from-emerald-500 to-green-600'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
        } ${className}`}
        style={{
          animation: isVisible ? 'fab-in 0.5s ease-out' : undefined,
        }}
      >
        {isCompleted ? (
          <>
            <div className="relative">
              <IconCheck size={24} className="text-white" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                <span className="text-emerald-500 text-[8px]">✓</span>
              </span>
            </div>
            <div className="text-left">
              <div className="font-bold text-white text-sm">
                Administration Selesai
              </div>
              <div className="text-[10px] text-white/80">Tap untuk detail</div>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <IconClock size={24} className="text-white" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
            <div className="text-left">
              <div className="font-bold text-white text-sm">
                Selesaikan Mengajar
              </div>
              <div className="text-[10px] text-white/80">
                {currentSchedule
                  ? `${currentSchedule.class_name}${currentSchedule.school_name ? ` (${currentSchedule.school_name})` : ''} - ${currentSchedule.jam_mulai}`
                  : 'Waktu mengajar aktif'}
              </div>
            </div>
          </>
        )}
      </button>

      {/* Modal */}
      <SelesaiMengajarModal
        isOpen={isModalOpen}
        onClose={handleClose}
        preselectedSchedule={currentSchedule || undefined}
        onComplete={handleComplete}
      />

      <style jsx>{`
        @keyframes fab-in {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(251, 191, 36, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
          }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s infinite;
        }
      `}</style>
    </>
  );
}