'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==========================================
// TYPES
// ==========================================

export interface School {
  id: string;
  nama_sekolah: string;
  logo: string | null;
  alamat: string | null;
  npsn: string | null;
  nama_kepala_sekolah: string | null;
  user_id: string;
}

export interface TahunAjaran {
  id: string;
  nama: string; // "2025/2026"
  semester_type: 'ganjil' | 'genap' | 'full';
  semester: 'ganjil' | 'genap' | null;
  is_active: boolean;
  tanggal_mulai: string;
  tanggal_selesai: string;
}

export interface Subject {
  id: string;
  school_id: string;
  nama_mapel: string;
}

export interface Class {
  id: string;
  school_id: string;
  nama_kelas: string;
  wali_kelas: string | null;
}

// ==========================================
// TEACHER CONTEXT STORE
// Manages: active school, class, subject, tahun ajaran
// For guru yang mengajar di banyak sekolah
// ==========================================

interface TeacherContextState {
  // --- Active Context (what user is currently working with) ---
  activeSchoolId: string | null;
  activeClassId: string | null;
  activeSubjectId: string | null;
  activeTahunAjaranId: string | null;
  activeSemester: 'ganjil' | 'genap' | null;

  // --- Full Data (all schools user has access to) ---
  schools: School[];
  tahunAjaranBySchool: Record<string, TahunAjaran[]>;
  classesBySchool: Record<string, Class[]>;
  subjectsBySchool: Record<string, Subject[]>;

  // --- Kurikulum Preferences per School ---
  kurikulumPrefs: Record<string, 'merdeka' | 'k13' | 'kbc' | 'hybrid'>;
  jenjangBySchool: Record<string, 'SD' | 'SMP' | 'SMA' | 'SMK'>;

  // --- Loading States ---
  isLoadingSchools: boolean;
  isLoadingData: boolean;

  // --- Actions ---
  setSchools: (schools: School[]) => void;
  setActiveSchool: (schoolId: string) => void;
  setActiveClass: (classId: string | null) => void;
  setActiveSubject: (subjectId: string | null) => void;
  setActiveTahunAjaran: (id: string, semester: 'ganjil' | 'genap' | null) => void;

  // Data setters
  setTahunAjaranBySchool: (schoolId: string, data: TahunAjaran[]) => void;
  setClassesBySchool: (schoolId: string, data: Class[]) => void;
  setSubjectsBySchool: (schoolId: string, data: Subject[]) => void;

  // Preferences
  setKurikulumPref: (schoolId: string, kurikulum: 'merdeka' | 'k13' | 'kbc' | 'hybrid') => void;
  setJenjangBySchool: (schoolId: string, jenjang: 'SD' | 'SMP' | 'SMA' | 'SMK') => void;

  // Loading
  setLoadingSchools: (loading: boolean) => void;
  setLoadingData: (loading: boolean) => void;

  // Helpers
  getActiveSchool: () => School | null;
  getActiveClass: () => Class | null;
  getActiveSubject: () => Subject | null;
  getActiveTahunAjaran: () => TahunAjaran | null;
  getActiveKurikulum: () => 'merdeka' | 'k13' | 'kbc' | 'hybrid';
  getActiveJenjang: () => 'SD' | 'SMP' | 'SMA' | 'SMK' | null;

  // Reset
  resetContext: () => void;
}

export const useTeacherStore = create<TeacherContextState>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      activeSchoolId: null,
      activeClassId: null,
      activeSubjectId: null,
      activeTahunAjaranId: null,
      activeSemester: null,

      schools: [],
      tahunAjaranBySchool: {},
      classesBySchool: {},
      subjectsBySchool: {},

      kurikulumPrefs: {},
      jenjangBySchool: {},

      isLoadingSchools: false,
      isLoadingData: false,

      // --- Actions ---
      setSchools: (schools) => {
        const currentActive = get().activeSchoolId;
        // Auto-select first school if none selected
        const newActive = currentActive && schools.find(s => s.id === currentActive)
          ? currentActive
          : schools.length === 1 ? schools[0].id
          : null;
        set({ schools, activeSchoolId: newActive });
      },

      setActiveSchool: (schoolId) => {
        const school = get().schools.find(s => s.id === schoolId);
        set({
          activeSchoolId: schoolId,
          activeClassId: null,
          activeSubjectId: null,
          // Reset tahun ajaran when switching schools
          activeTahunAjaranId: null,
          activeSemester: null,
        });
      },

      setActiveClass: (classId) => set({ activeClassId: classId }),
      setActiveSubject: (subjectId) => set({ activeSubjectId: subjectId }),

      setActiveTahunAjaran: (id, semester) => set({
        activeTahunAjaranId: id,
        activeSemester: semester,
      }),

      // Data setters
      setTahunAjaranBySchool: (schoolId, data) => set(state => ({
        tahunAjaranBySchool: { ...state.tahunAjaranBySchool, [schoolId]: data }
      })),

      setClassesBySchool: (schoolId, data) => set(state => ({
        classesBySchool: { ...state.classesBySchool, [schoolId]: data }
      })),

      setSubjectsBySchool: (schoolId, data) => set(state => ({
        subjectsBySchool: { ...state.subjectsBySchool, [schoolId]: data }
      })),

      setKurikulumPref: (schoolId, kurikulum) => set(state => ({
        kurikulumPrefs: { ...state.kurikulumPrefs, [schoolId]: kurikulum }
      })),

      setJenjangBySchool: (schoolId, jenjang) => set(state => ({
        jenjangBySchool: { ...state.jenjangBySchool, [schoolId]: jenjang }
      })),

      setLoadingSchools: (loading) => set({ isLoadingSchools: loading }),
      setLoadingData: (loading) => set({ isLoadingData: loading }),

      // Helpers
      getActiveSchool: () => {
        const { schools, activeSchoolId } = get();
        return schools.find(s => s.id === activeSchoolId) ?? null;
      },

      getActiveClass: () => {
        const { classesBySchool, activeSchoolId, activeClassId } = get();
        if (!activeSchoolId || !activeClassId) return null;
        return classesBySchool[activeSchoolId]?.find(c => c.id === activeClassId) ?? null;
      },

      getActiveSubject: () => {
        const { subjectsBySchool, activeSchoolId, activeSubjectId } = get();
        if (!activeSchoolId || !activeSubjectId) return null;
        return subjectsBySchool[activeSchoolId]?.find(s => s.id === activeSubjectId) ?? null;
      },

      getActiveTahunAjaran: () => {
        const { tahunAjaranBySchool, activeSchoolId, activeTahunAjaranId } = get();
        if (!activeSchoolId || !activeTahunAjaranId) return null;
        return tahunAjaranBySchool[activeSchoolId]?.find(t => t.id === activeTahunAjaranId) ?? null;
      },

      getActiveKurikulum: () => {
        const { kurikulumPrefs, activeSchoolId } = get();
        return (activeSchoolId ? kurikulumPrefs[activeSchoolId] : undefined) ?? 'merdeka';
      },

      getActiveJenjang: () => {
        const { jenjangBySchool, activeSchoolId } = get();
        return activeSchoolId ? (jenjangBySchool[activeSchoolId] ?? null) : null;
      },

      resetContext: () => set({
        activeSchoolId: null,
        activeClassId: null,
        activeSubjectId: null,
        activeTahunAjaranId: null,
        activeSemester: null,
        tahunAjaranBySchool: {},
        classesBySchool: {},
        subjectsBySchool: {},
        kurikulumPrefs: {},
      }),
    }),
    {
      name: 'gurupro-teacher-context',
      partialize: (state) => ({
        // Only persist selection preferences, not loading states
        schools: state.schools,
        activeSchoolId: state.activeSchoolId,
        activeClassId: state.activeClassId,
        activeSubjectId: state.activeSubjectId,
        activeTahunAjaranId: state.activeTahunAjaranId,
        activeSemester: state.activeSemester,
        kurikulumPrefs: state.kurikulumPrefs,
        jenjangBySchool: state.jenjangBySchool,
      }),
    }
  )
);

// ==========================================
// KURIKULUM OPTIONS STORE
// Manages: 8 Dimensi, 3 Pengalaman Belajar, PAI Mode
// For Deep Learning (Kerangka 8334)
// ==========================================

export interface Dimensi8Option {
  key: string;
  label: string;
  description: string;
  icon: string;
}

export const DIMENSI_8_OPTIONS: Dimensi8Option[] = [
  {
    key: 'imtaq',
    label: '1. Beriman, Bertakwa, Berakhlak Mulia',
    description: 'Imtaq - Internalisasi nilai-nilai keimanan dan ketakwaan',
    icon: '🕌',
  },
  {
    key: 'berkebinekaan_global',
    label: '2. Berkebinekaan Global',
    description: 'Menghargai keberagaman dan kebinekaan',
    icon: '🌏',
  },
  {
    key: 'bergotong_royong',
    label: '3. Gotong Royong',
    description: 'Kerja sama dan gotong royong dalam pembelajaran',
    icon: '🤝',
  },
  {
    key: 'merdeka',
    label: '4. Merdeka',
    description: 'Kemandirian dalam belajar dan berpikir',
    icon: '🦅',
  },
  {
    key: 'kreatif',
    label: '5. Kreatif',
    description: 'Kemampuan berkreasi dan berinovasi',
    icon: '💡',
  },
  {
    key: 'bernalar_kritis',
    label: '6. Bernalar Kritis',
    description: 'Berpikir logis, kritis, dan sistematis',
    icon: '🧠',
  },
  {
    key: 'budi_pekerti_luhur',
    label: '7. Mengakar pada Budi Pekerti Luhur',
    description: 'Berakar pada nilai-nilai budaya dan karakter',
    icon: '🌳',
  },
  {
    key: 'kreativitas',
    label: '8. Kreativitas (Deep Learning)',
    description: 'Fokus Deep Learning - menghasilkan karya original',
    icon: '✨',
  },
];

export interface TigaPengalamanOption {
  key: string;
  label: string;
  taxonomyLevel: string;
  description: string;
  activities: string[];
}

export const TIGA_PENGALAMAN_OPTIONS: TigaPengalamanOption[] = [
  {
    key: 'memahami',
    label: 'Memahami (Understand)',
    taxonomyLevel: 'C2',
    description: 'Eksplorasi konsep, tanya jawab, demonstrasi',
    activities: [
      'Aktivitas eksplorasi konsep',
      'Tanya jawab terstruktur',
      'Demonstrasi dan visualisasi',
      'Catatan konsep / peta pikiran',
    ],
  },
  {
    key: 'mengaplikasi',
    label: 'Mengaplikasi (Apply)',
    taxonomyLevel: 'C3',
    description: 'Simulasi, latihan, proyek mini, LKPD',
    activities: [
      'Simulasi dan latihan terbimbing',
      'Proyek mini / tugas praktis',
      'Kerja kelompok (LKPD)',
      'Produk: hasil kerja nyata',
    ],
  },
  {
    key: 'merefleksikan',
    label: 'Merefleksikan (Reflect)',
    taxonomyLevel: 'C4-C6',
    description: 'Diskusi reflektif, presentasi, asesmen diri',
    activities: [
      'Diskusi reflektif',
      'Presentasi dan umpan balik',
      'Asesmen diri dan portofolio',
      'Transfer pengetahuan ke konteks baru',
    ],
  },
];

interface KurikulumOptionsState {
  // 8 Dimensi Profil Lulusan - selected keys
  selectedDimensi8: string[];

  // 3 Pengalaman Belajar
  useTigaPengalaman: boolean;
  selectedPengalaman: string[]; // ['memahami', 'mengaplikasi', 'merefleksikan']

  // PAI Special Mode
  paiModeEnabled: boolean;
  paiIntegration: 'none' | 'spiritual_only' | 'hybrid_kbc';
  paiKepkaRef: string; // "Kepka BKPDM No. 020/2026"

  // Capaian Pembelajaran phase
  activeFase: string | null; // 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

  // Actions
  toggleDimensi8: (key: string) => void;
  setSelectedDimensi8: (keys: string[]) => void;

  setUseTigaPengalaman: (value: boolean) => void;
  togglePengalaman: (key: string) => void;
  setSelectedPengalaman: (keys: string[]) => void;

  setPaiModeEnabled: (value: boolean) => void;
  setPaiIntegration: (value: 'none' | 'spiritual_only' | 'hybrid_kbc') => void;
  setActiveFase: (fase: string | null) => void;

  // Reset all
  resetKurikulumOptions: () => void;

  // Serialize for API calls
  serializeForAPI: () => {
    dimensi8: string[];
    tiga_pengalaman: boolean;
    pengalaman_keys: string[];
    pai_mode: string | null;
    fase: string | null;
  };
}

export const useKurikulumStore = create<KurikulumOptionsState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedDimensi8: [],
      useTigaPengalaman: false,
      selectedPengalaman: [],
      paiModeEnabled: false,
      paiIntegration: 'none',
      paiKepkaRef: 'Kepka BKPDM No. 020/2026',
      activeFase: null,

      // Actions
      toggleDimensi8: (key) => set(state => ({
        selectedDimensi8: state.selectedDimensi8.includes(key)
          ? state.selectedDimensi8.filter(k => k !== key)
          : [...state.selectedDimensi8, key]
      })),

      setSelectedDimensi8: (keys) => set({ selectedDimensi8: keys }),

      setUseTigaPengalaman: (value) => set(state => ({
        useTigaPengalaman: value,
        selectedPengalaman: value ? ['memahami', 'mengaplikasi', 'merefleksikan'] : [],
      })),

      togglePengalaman: (key) => set(state => ({
        selectedPengalaman: state.selectedPengalaman.includes(key)
          ? state.selectedPengalaman.filter(k => k !== key)
          : [...state.selectedPengalaman, key]
      })),

      setSelectedPengalaman: (keys) => set({ selectedPengalaman: keys }),

      setPaiModeEnabled: (value) => set({ paiModeEnabled: value }),

      setPaiIntegration: (value) => set({ paiIntegration: value }),

      setActiveFase: (fase) => set({ activeFase: fase }),

      resetKurikulumOptions: () => set({
        selectedDimensi8: [],
        useTigaPengalaman: false,
        selectedPengalaman: [],
        paiModeEnabled: false,
        paiIntegration: 'none',
        activeFase: null,
      }),

      serializeForAPI: () => {
        const state = get();
        return {
          dimensi8: state.selectedDimensi8,
          tiga_pengalaman: state.useTigaPengalaman,
          pengalaman_keys: state.selectedPengalaman,
          pai_mode: state.paiModeEnabled ? state.paiIntegration : null,
          fase: state.activeFase,
        };
      },
    }),
    {
      name: 'gurupro-kurikulum-options',
    }
  )
);
