'use client';

import { useEffect } from 'react';
import { useTeacherStore } from './teacherStore';

// ==========================================
// DASHBOARD INTEGRATION HOOK
// Use this hook in dashboard/page.tsx to load school data
// ==========================================

export function useDashboardInit() {
  const {
    schools,
    setSchools,
    activeSchoolId,
    setActiveSchool,
    setTahunAjaranBySchool,
    setClassesBySchool,
    setSubjectsBySchool,
    setLoadingSchools,
    isLoadingSchools,
  } = useTeacherStore();

  // Load schools on mount
  useEffect(() => {
    if (schools.length === 0) {
      loadSchools();
    }
  }, []);

  // When active school changes, load its data
  useEffect(() => {
    if (activeSchoolId) {
      loadSchoolData(activeSchoolId);
    }
  }, [activeSchoolId]);

  const loadSchools = async () => {
    setLoadingSchools(true);
    try {
      const res = await fetch('/api/school-assignments');
      if (res.ok) {
        const data = await res.json();
        setSchools(data.data || []);

        // Auto-select first school if none selected
        if (data.data?.length > 0 && !activeSchoolId) {
          setActiveSchool(data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load schools:', err);
    } finally {
      setLoadingSchools(false);
    }
  };

  const loadSchoolData = async (schoolId: string) => {
    try {
      // Load tahun ajaran
      const tahunRes = await fetch(`/api/tahun-ajaran?school_id=${schoolId}`);
      if (tahunRes.ok) {
        const tahunData = await tahunRes.json();
        setTahunAjaranBySchool(schoolId, tahunData.data || []);
      }

      // Load classes
      const kelasRes = await fetch(`/api/classes?school_id=${schoolId}`);
      if (kelasRes.ok) {
        const kelasData = await kelasRes.json();
        setClassesBySchool(schoolId, kelasData.rows || kelasData.data || []);
      }

      // Load subjects
      const mapelRes = await fetch(`/api/teacher-subject-assignments?school_id=${schoolId}`);
      if (mapelRes.ok) {
        const mapelData = await mapelRes.json();
        // Map to subject format for the store
        const subjects = (mapelData.data || []).map((s: any) => ({
          id: s.id,
          school_id: schoolId,
          nama_mapel: s.nama_mapel,
        }));
        setSubjectsBySchool(schoolId, subjects);
      } else {
        // Fallback: load from subjects API
        const mapelRes2 = await fetch(`/api/subjects?school_id=${schoolId}`);
        if (mapelRes2.ok) {
          const mapelData2 = await mapelRes2.json();
          setSubjectsBySchool(schoolId, mapelData2.rows || mapelData2.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to load school data:', err);
    }
  };

  return {
    loadSchools,
    loadSchoolData,
    isLoadingSchools,
    hasSchools: schools.length > 0,
    schoolCount: schools.length,
  };
}

// ==========================================
// HELPERS FOR FORM PAYLOAD
// Convert store state to API payload
// ==========================================

export function buildAdminPayload(
  formData: any,
  store: ReturnType<typeof useTeacherStore.getState>,
  kurikulumStore: ReturnType<typeof useTeacherStore.getState>
) {
  const activeSchool = store.getActiveSchool();
  const activeSubject = store.getActiveSubject();

  return {
    ...formData,
    // School context
    school_id: store.activeSchoolId,
    school_name: activeSchool?.nama_sekolah,
    school_npsn: activeSchool?.npsn,
    school_address: activeSchool?.alamat,
    // Subject context
    subject_id: store.activeSubjectId,
    mapel: formData.mapel || activeSubject?.nama_mapel,
    // Academic context
    jenjang: store.getActiveJenjang(),
    fase: formData.fase,
    semester: store.activeSemester,
    tahun_ajaran: store.getActiveTahunAjaran()?.nama,
  };
}
