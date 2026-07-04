// ==========================================
// TYPES FOR SELESAI MENGAJAR FEATURE
// ==========================================

export interface SelesaiMengajarInput {
  guru_id: string;
  kelas_id: string;
  kelas_nama: string;
  mapel_id: string;
  mapel_nama: string;
  tanggal: string; // ISO date
  jam_mulai: string; // HH:MM
  jam_selesai: string; // HH:MM
  topik_diajarkan: string;
  jumlah_hadir: number;
  jumlah_izin: number;
  jumlah_sakit: number;
  jumlah_alpha: number;
  catatan_tambahan?: string;
  rpp_id?: string;
  school_id?: string;
  schedule_id?: string;
}

export interface ScheduleInfo {
  id: string;
  class_id: string;
  subject_id: string;
  school_id: string;
  school_name?: string;
  class_name: string;
  subject_name: string;
  jam_mulai: string;
  jam_selesai: string;
}

export interface AttendanceSummary {
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  total: number;
}

// Progress Events for SSE
export type ProgressStep = 'start' | 'jurnal' | 'absensi' | 'atp' | 'memory' | 'next' | 'complete' | 'error';
export type ProgressStatus = 'loading' | 'done' | 'error';

export interface ProgressEvent {
  step: ProgressStep;
  status?: ProgressStatus;
  message?: string;
  data?: any;
}

// Result from each sub-function
export interface JurnalResult {
  id: string;
  materi_pembelajaran: string;
  refleksi: string;
}

export interface AbsensiResult {
  saved: boolean;
  count: number;
}

export interface ATPResult {
  updated: boolean;
  progress_minggu: number;
  total_minggu: number;
}

export interface MemoryResult {
  updated: boolean;
  last_topic: string;
}

export interface NextMateriResult {
  topik_berikutnya: string;
  sub_materi: string;
  perlu_remedial: boolean;
  catatan_persiapan: string;
}

export interface SelesaiMengajarResult {
  jurnal: JurnalResult | null;
  absensi_summary: AttendanceSummary;
  atp_updated: ATPResult | null;
  memory_updated: MemoryResult | null;
  next_materi: NextMateriResult | null;
  errors: string[];
}