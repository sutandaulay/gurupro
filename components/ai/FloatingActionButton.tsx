"use client";
import { apiFetch } from "@/lib/api-client";

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
  IconLoader2,
} from "@tabler/icons-react";
import { SelesaiMengajarModal } from "@/components/selesai-mengajar";

interface ScheduleInfo {
  id: string;
  class_id: string;
  subject_id: string;
  school_id: string;
  class_name: string;
  subject_name: string;
  jam_mulai: string;
  jam_selesai: string;
  school_name?: string;
  isCompleted?: boolean;
}

interface TaskItem {
  id: string;
  task_title: string;
  task_type: string;
  status: string;
  due_date: string | null;
  priority: string;
}

function switchToModule(module: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("switchModule", { detail: { module } })
    );
  }
}

function isJamMengajar(
  schedules: ScheduleInfo[],
  currentTime: Date,
  marginMinutes: number = 30
): boolean {
  if (!schedules.length) return false;
  const currentMinutes =
    currentTime.getHours() * 60 + currentTime.getMinutes();
  for (const schedule of schedules) {
    const [startHour, startMin] = schedule.jam_mulai.split(":").map(Number);
    const [endHour, endMin] = schedule.jam_selesai.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin - marginMinutes;
    const endMinutes = endHour * 60 + endMin + marginMinutes;
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes)
      return true;
  }
  return false;
}

function getFabState(
  schedules: ScheduleInfo[]
): "completed" | "in_progress" | "available" {
  if (!schedules.length) return "available";

  // A schedule counts as "done" only when its own completed session exists.
  const incompleteSchedules = schedules.filter((s) => !s.isCompleted);
  if (incompleteSchedules.length === 0) return "completed";

  if (typeof window !== "undefined") {
    const inProgress = incompleteSchedules.some(
      (s) => localStorage.getItem(`teaching_session_${s.id}`) === "active"
    );
    if (inProgress) return "in_progress";
  }

  return "available";
}

function getCurrentSchedule(schedules: ScheduleInfo[]): ScheduleInfo | null {
  const now = new Date();
  const incomplete = schedules.filter((s) => !s.isCompleted);
  const candidates = incomplete.length ? incomplete : schedules;
  return candidates.find((s) => isJamMengajar([s], now, 30)) || candidates[0] || null;
}

const FAB_LABEL = {
  completed: "Administration Selesai",
  in_progress: "Lanjutkan",
  available: "Mulai Mengajar",
} as const;

const FAB_COLOR = {
  completed: "from-emerald-500 to-green-600",
  in_progress: "from-amber-500 to-orange-500",
  available: "from-violet-500 to-purple-600",
} as const;

const FAB_SUBTITLE = {
  completed: "Tap untuk detail",
  in_progress: (s: ScheduleInfo) =>
    `${s.class_name} - ${s.jam_mulai}`,
  available: (s: ScheduleInfo) =>
    `${s.class_name} - ${s.jam_mulai}`,
} as const;

export default function FloatingActionButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [todaySession, setTodaySession] = useState<any>(null);
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<ScheduleInfo[]>([]);
  const [fabState, setFabState] = useState<
    "completed" | "in_progress" | "available"
  >("available");
  const [currentSchedule, setCurrentSchedule] =
    useState<ScheduleInfo | null>(null);
  const [mounted, setMounted] = useState(false);

  const fetchTodayData = async () => {
    try {
      const response = await apiFetch("/api/teaching-session");
      if (response.ok) {
        const data = await response.json();
        setTodaySession(data.session);
        setPendingTasks(data.pendingTasks || []);

        const schedules: ScheduleInfo[] = (
          data.todaySchedules || []
        ).map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          subject_id: s.subject_id,
          school_id: s.school_id,
          class_name: s.classes?.nama_kelas || "",
          subject_name: s.subjects?.nama_mapel || "",
          jam_mulai: s.jam_mulai,
          jam_selesai: s.jam_selesai,
          school_name: s.school?.nama || "",
          isCompleted: !!s.isCompleted,
        }));
        setTodaySchedules(schedules);

        const state = getFabState(schedules);
        setFabState(state);
        setCurrentSchedule(getCurrentSchedule(schedules));
      }
    } catch (error) {
      console.error("Failed to fetch today's data:", error);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchTodayData();
    const interval = setInterval(fetchTodayData, 60000);

    const handleOpenFromCard = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSelectedSchedule(detail.schedule || null);
      setIsModalOpen(true);
    };
    window.addEventListener("openSelesaiMengajar", handleOpenFromCard);
    const handleSessionDone = () => fetchTodayData();
    window.addEventListener("selesaiMengajarDone", handleSessionDone);

    return () => {
      clearInterval(interval);
      window.removeEventListener("openSelesaiMengajar", handleOpenFromCard);
      window.removeEventListener("selesaiMengajarDone", handleSessionDone);
    };
  }, []);

  const journalGenerated = todaySession?.journal_generated;
  const pendingCount = pendingTasks.length;
  const hasUncompletedJournal = !journalGenerated;

  const handleOpenModal = () => {
    const incomplete = todaySchedules.filter((s) => !s.isCompleted);
    const candidates = incomplete.length ? incomplete : todaySchedules;
    if (candidates.length === 1) {
      setSelectedSchedule(candidates[0]);
    } else if (typeof window !== "undefined") {
      // If multiple schedules, try to find the one with an active session
      const inProgressSchedule = candidates.find(
        (s) => localStorage.getItem(`teaching_session_${s.id}`) === "active"
      );
      if (inProgressSchedule) {
        setSelectedSchedule(inProgressSchedule);
      }
    }
    setIsModalOpen(true);
    setIsExpanded(false);
  };

  const handleComplete = () => {
    fetchTodayData();
  };

  // Standalone modal state
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleInfo | null>(null);

  // Only show FAB during teaching hours
  const now = new Date();
  const inJam = isJamMengajar(todaySchedules, now, 30);
  const showFab = mounted && (inJam || fabState !== "available");

  const fabLabel = FAB_LABEL[fabState];
  const fabColor = FAB_COLOR[fabState];
  const fabSubtitle =
    fabState === "completed"
      ? FAB_SUBTITLE.completed
      : currentSchedule
      ? typeof FAB_SUBTITLE[fabState] === "function"
        ? (FAB_SUBTITLE[fabState] as (s: ScheduleInfo) => string)(currentSchedule)
        : FAB_SUBTITLE[fabState]
      : "Waktu mengajar aktif";

  return (
    <>
      {/* Expanded Panel */}
      {isExpanded && (
        <>
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
                  <span className="font-bold text-white text-sm">AI Assistant</span>
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
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Aksi Cepat
                </p>

                {/* Selesaikan Mengajar */}
                <button
                  onClick={() => {
                    handleOpenModal();
                  }}
                  disabled={fabState === "completed"}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                    fabState === "completed"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700"
                  }`}
                >
                  <IconCheck size={18} />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">
                      {fabState === "completed" ? "Selesai" : "Selesaikan Mengajar"}
                    </div>
                    <div className="text-[10px] opacity-80">
                      {fabState === "completed"
                        ? "Administrasi hari ini lengkap"
                        : "AI bantu lengkapi administrasi"}
                    </div>
                  </div>
                  <IconChevronRight size={16} />
                </button>

                <button
                  onClick={() => switchToModule("jurnal")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  <IconClipboardCheck size={18} className="text-slate-500" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-700">
                      Jurnal Saya
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {hasUncompletedJournal ? "Belum dibuat hari ini" : "Sudah dibuat"}
                    </div>
                  </div>
                  <IconChevronRight size={16} className="text-slate-400" />
                </button>

                <button
                  onClick={() => switchToModule("nilai")}
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
                  onClick={() => { window.location.href = "/dashboard/chat"; }}
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

      {/* Main FAB - Smart labels merged */}
      <button
        onClick={() => {
          if (isExpanded) {
            setIsExpanded(false);
          } else if (fabState === "available" || fabState === "in_progress") {
            // Open modal directly
            handleOpenModal();
          } else {
            setIsExpanded(true);
          }
        }}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl transition-all duration-300 group ${
          fabState === "completed"
            ? "bg-gradient-to-r from-emerald-500 to-green-600"
            : fabState === "in_progress"
            ? "bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse"
            : "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
        }`}
      >
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          {fabState === "completed" ? (
            <IconCheck size={22} className="text-white" />
          ) : fabState === "in_progress" ? (
            <IconLoader2 size={22} className="text-white animate-spin" />
          ) : (
            <IconSparkles size={22} className="text-white" />
          )}
        </div>
        <div className="text-left">
          <div className="font-bold text-white text-sm leading-tight">
            {fabLabel}
          </div>
          <div className="text-[10px] text-white/80 leading-tight">
            {fabSubtitle}
          </div>
        </div>
      </button>

      {/* Selesai Mengajar Modal */}
      <SelesaiMengajarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        preselectedSchedule={selectedSchedule || undefined}
        onComplete={handleComplete}
      />

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
