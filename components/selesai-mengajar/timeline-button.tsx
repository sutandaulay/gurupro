"use client";

import React from 'react';
import { IconCheck, IconClock } from '@tabler/icons-react';
import SelesaiMengajarModal from './modal';
import type { ScheduleInfo } from '@/lib/selesai-mengajar/types';

interface TimelineSelesaiButtonProps {
  schedule: ScheduleInfo;
  isCompleted?: boolean;
  onCompleted?: () => void;
}

/**
 * Button displayed in the AI Timeline (Dashboard Daily View)
 * Shows "Selesai Mengajar" button for each schedule that hasn't been completed
 */
export default function TimelineSelesaiButton({
  schedule,
  isCompleted = false,
  onCompleted,
}: TimelineSelesaiButtonProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  if (isCompleted) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
          <IconCheck size={14} className="text-white" />
        </div>
        <span className="text-sm font-medium text-emerald-700">
          Administration Selesai
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg group"
      >
        <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
          <IconCheck size={14} />
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold">Selesai Mengajar</div>
          <div className="text-[10px] text-white/80 flex items-center gap-1">
            <IconClock size={10} />
            <span>{schedule.jam_mulai}</span>
          </div>
        </div>
      </button>

      <SelesaiMengajarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        preselectedSchedule={schedule}
        onComplete={(result) => {
          onCompleted?.();
        }}
      />
    </>
  );
}