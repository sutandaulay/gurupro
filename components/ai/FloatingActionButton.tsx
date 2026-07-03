"use client";

import React, { useState, useEffect } from "react";
import {
  IconSparkles,
  IconX,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconClipboardCheck,
  IconChartBar,
  IconMessage,
  IconBook,
  IconFileDescription,
} from "@tabler/icons-react";
import SelesaiMengajarModal from "./SelesaiMengajarModal";
import { SelesaiMengajarFAB, SelesaiMengajarModal as NewSelesaiMengajarModal } from "@/components/selesai-mengajar";

interface ScheduleInfo {
  id: string;
  class_id: string;
  subject_id: string;
  school_id: string;
  class_name: string;
  subject_name: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface AttendanceRecord {
  student_id: string;
  student_name: string;
  status: string;
  catatan?: string;
}

interface TaskItem {
  id: string;
  task_title: string;
  task_type: string;
  status: string;
  due_date: string | null;
  priority: string;
}

// Helper to switch module on dashboard
function switchToModule(module: string) {
  if (typeof window !== 'undefined') {
    // Use custom event to trigger module switch
    window.dispatchEvent(new CustomEvent('switchModule', { detail: { module } }));
  }
}

export default function FloatingActionButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [todaySession, setTodaySession] = useState<any>(null);
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<ScheduleInfo[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleInfo | null>(null);

  const fetchTodayData = async () => {
    try {
      const response = await fetch("/api/teaching-session");
      if (response.ok) {
        const data = await response.json();
        setTodaySession(data.session);
        setPendingTasks(data.pendingTasks || []);

        // Transform schedules data
        const schedules: ScheduleInfo[] = (data.todaySchedules || []).map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          subject_id: s.subject_id,
          school_id: s.school_id,
          class_name: s.classes?.nama_kelas || "",
          subject_name: s.subjects?.nama_mapel || "",
          jam_mulai: s.jam_mulai,
          jam_selesai: s.jam_selesai,
        }));
        setTodaySchedules(schedules);
      }
    } catch (error) {
      console.error("Failed to fetch today's data:", error);
    }
  };

  // Fetch today's session and tasks
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTodayData();
  }, []);

  // Check if teaching session is already completed
  const isCompleted = todaySession?.status === "completed";
  const journalGenerated = todaySession?.journal_generated;

  // Calculate pending items
  const pendingCount = pendingTasks.length;
  const hasUncompletedJournal = !journalGenerated;

  // Get current time to check if within teaching hours
  const now = new Date();
  const currentHour = now.getHours();
  const isTeachingHours = currentHour >= 7 && currentHour <= 17;

  const handleOpenModal = () => {
    // If there's only one schedule, select it automatically
    if (todaySchedules.length === 1) {
      setSelectedSchedule(todaySchedules[0]);
    }
    setIsModalOpen(true);
    setIsExpanded(false);
  };

  const handleComplete = (result: any) => {
    setTodaySession(result.session);
    fetchTodayData(); // Refresh data
  };

  return (
    <>
      {/* Expanded Panel */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setIsExpanded(false)}
          />

          {/* Panel */}
          <div className="fixed bottom-24 right-6 z-50 w-72 bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconSparkles className="text-white" size={18} />
                  <span className="font-bold text-white text-sm">
                    AI Assistant
                  </span>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-white/80 hover:text-white"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Quick Actions */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Aksi Cepat
                </p>

                {/* Selesaikan Mengajar - Opens new modal */}
                <button
                  onClick={() => {
                    setIsModalOpen(true);
                    setIsExpanded(false);
                  }}
                  disabled={isCompleted}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                    isCompleted
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700"
                  }`}
                >
                  <IconCheck size={18} />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">
                      {isCompleted ? "Selesai" : "Selesaikan Mengajar"}
                    </div>
                    <div className="text-[10px] opacity-80">
                      {isCompleted
                        ? "Administrasi hari ini lengkap"
                        : "AI bantu lengkapi administrasi"}
                    </div>
                  </div>
                  <IconChevronRight size={16} />
                </button>

                <button
                  onClick={() => switchToModule('jurnal')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  <IconClipboardCheck size={18} className="text-slate-500" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-700">
                      Jurnal Saya
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {hasUncompletedJournal
                        ? "Belum dibuat hari ini"
                        : "Sudah dibuat"}
                    </div>
                  </div>
                  <IconChevronRight size={16} className="text-slate-400" />
                </button>

                <button
                  onClick={() => switchToModule('nilai')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  <IconChartBar size={18} className="text-slate-500" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-700">
                      Input Nilai
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Kelola nilai siswa
                    </div>
                  </div>
                  <IconChevronRight size={16} className="text-slate-400" />
                </button>

                <button
                  onClick={() => { window.location.href = '/dashboard/chat'; }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  <IconMessage size={18} className="text-slate-500" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-700">
                      Chat AI
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Tanyakan apa saja
                    </div>
                  </div>
                  <IconChevronRight size={16} className="text-slate-400" />
                </button>
              </div>

              {/* Pending Tasks */}
              {pendingCount > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Tugas Pending ({pendingCount})
                  </p>
                  <div className="space-y-1">
                    {pendingTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 text-xs text-slate-600 bg-amber-50 px-2 py-1.5 rounded-lg"
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            task.priority === "high"
                              ? "bg-rose-500"
                              : task.priority === "medium"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span className="truncate">{task.task_title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Today Schedule */}
              {todaySchedules.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Jadwal Hari Ini ({todaySchedules.length})
                  </p>
                  <div className="space-y-1">
                    {todaySchedules.slice(0, 2).map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded-lg"
                      >
                        <IconClock size={12} className="text-slate-400" />
                        <span>
                          {schedule.jam_mulai} - {schedule.subject_name} (
                          {schedule.class_name})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl transition-all duration-300 group ${
          isCompleted
            ? "bg-gradient-to-r from-emerald-500 to-green-600"
            : isExpanded
            ? "bg-slate-100 text-slate-700"
            : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
        }`}
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
                administration Selesai
              </div>
              <div className="text-[10px] text-white/80">
                Tap untuk aksi lain
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <IconSparkles size={24} className="text-white" />
              {!isExpanded && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              )}
            </div>
            {isExpanded ? (
              <IconX size={20} className="text-slate-500" />
            ) : (
              <div className="text-left">
                <div className="font-bold text-white text-sm">
                  Selesaikan Mengajar
                </div>
                <div className="text-[10px] text-white/80">
                  AI bantu lengkapi administrasi
                </div>
              </div>
            )}
          </>
        )}
      </button>

      {/* Old Modal - keep for backward compatibility */}
      <SelesaiMengajarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        schedule={selectedSchedule || undefined}
        attendanceData={attendanceData}
        onComplete={handleComplete}
      />

      {/* New Selesai Mengajar Modal - with SSE streaming */}
      <NewSelesaiMengajarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* New Selesai Mengajar FAB - Appears during teaching hours */}
      <SelesaiMengajarFAB />

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}