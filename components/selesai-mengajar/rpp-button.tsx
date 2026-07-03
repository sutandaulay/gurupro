"use client";

import React from 'react';
import { IconCheck, IconSparkles, IconBook, IconArrowRight } from '@tabler/icons-react';
import SelesaiMengajarModal from './modal';

interface RppInfo {
  id: string;
  judul: string;
  mapel: string;
  kelas: string;
  class_id: string;
  subject_id: string;
  schedule_id?: string;
}

interface RppScheduleInfo {
  id: string;
  class_id: string;
  subject_id: string;
  school_id: string;
  class_name: string;
  subject_name: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface SelesaiButtonRppProps {
  rpp: RppInfo;
  schedule?: RppScheduleInfo;
  className?: string;
}

/**
 * Button displayed in the RPP detail page
 * "Selesaikan Mengajar dengan RPP Ini" - pre-fills data from RPP
 */
export default function SelesaiButtonRpp({
  rpp,
  schedule,
  className = '',
}: SelesaiButtonRppProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-2xl transition-all shadow-lg hover:shadow-xl ${className}`}
      >
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <IconSparkles size={20} />
        </div>
        <div className="text-left">
          <div className="font-bold">Selesaikan Mengajar</div>
          <div className="text-xs text-white/80">
            dengan RPP: {rpp.judul.substring(0, 30)}...
          </div>
        </div>
        <IconArrowRight size={20} className="ml-2" />
      </button>

      <SelesaiMengajarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        preselectedSchedule={schedule}
        rppId={rpp.id}
      />
    </>
  );
}