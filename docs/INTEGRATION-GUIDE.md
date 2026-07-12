# GURUPRO - Multi-School Deep Learning Integration Guide

## Overview

This guide explains how to integrate the new multi-school and Deep Learning features into the existing dashboard.

---

## 1. Database Migration

### Option A: Run SQL Manually (Recommended)
```bash
# Run the migration SQL file
psql -U postgres -d gurupro_db -f migrations/multi-school-deep-learning.sql
```

### Option B: Run Prisma DB Push
```bash
# First backup your database!
npx prisma db push
npx prisma generate
```

---

## 2. Integrate Stores in Dashboard

### Update `app/dashboard/page.tsx`

```tsx
'use client';
import { useEffect } from 'react';
import { useTeacherStore, useKurikulumStore } from '@/lib/stores';
import { useDashboardInit } from '@/lib/stores/use-dashboard';

export default function DashboardPage() {
  const { schools, activeSchoolId, setActiveSchool } = useTeacherStore();
  const { selectedDimensi8, useTigaPengalaman } = useKurikulumStore();

  // Initialize dashboard with school data
  const { loadSchools, isLoadingSchools } = useDashboardInit();

  // ... rest of your dashboard code

  // When generating documents, include context:
  const handleGenerate = async (formData: any) => {
    const activeSchool = useTeacherStore.getState().getActiveSchool();

    const payload = {
      ...formData,
      // School context
      school_id: activeSchoolId,
      school_name: activeSchool?.nama_sekolah,
      school_npsn: activeSchool?.npsn,
      // Deep Learning context
      dimensi8: selectedDimensi8,
      tiga_pengalaman: useTigaPengalaman,
      pai_mode: formData.paiModeEnabled ? formData.paiIntegration : null,
    };

    // Call API
    await fetch('/api/generate-administrasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };
}
```

---

## 3. New API Endpoints

### School Assignments
```typescript
// GET - List user's schools
GET /api/school-assignments
Response: { data: School[], count: number }

// POST - Add user to school
POST /api/school-assignments
Body: { school_id: string, tahun_ajaran_id?: string }
Response: { success: true, assignment_id: string }

// DELETE - Remove user from school
DELETE /api/school-assignments?school_id=xxx
Response: { success: true }
```

### Teacher Subject Assignments
```typescript
// GET - List user's subjects at school
GET /api/teacher-subject-assignments?school_id=xxx
Response: { data: Subject[], count: number }

// POST - Assign subject to user
POST /api/teacher-subject-assignments
Body: { school_id: string, subject_id: string }
Response: { success: true }

// DELETE - Remove subject assignment
DELETE /api/teacher-subject-assignments?school_id=xxx&subject_id=yyy
Response: { success: true }
```

### Prota Generator
```typescript
POST /api/generate-prota
Body: {
  school_id?: string,
  school_name?: string,
  tahun_ajaran?: string,
  jenjang: string,
  kurikulum: string,
  mapel: string,
  kelas: string,
  dimensi8?: string[],
}
Response: { judul: string, konten: string }
```

### Prosem Generator
```typescript
POST /api/generate-prosem
Body: {
  school_id?: string,
  school_name?: string,
  semester: 'ganjil' | 'genap',
  jenjang: string,
  kurikulum: string,
  mapel: string,
  kelas: string,
  minggu_efektif?: number,
  dimensi8?: string[],
}
Response: { judul: string, konten: string }
```

### ATP Editor
```typescript
// GET - List ATP documents
GET /api/atp?school_id=xxx&subject_id=yyy
Response: { data: ATP[], count: number }

// POST - Create new ATP
POST /api/atp
Body: { judul_dokumen: string, konten: object, ... }

// POST - Generate ATP with AI
POST /api/atp/generate
Body: { school_id, mapel, jenjang, kurikulum, fase, semester, dimensi8, ... }
Response: { judul: string, konten: string }
```

---

## 4. New Components

### SchoolSwitcher
Shows school dropdown when user has multiple schools.
```tsx
import SchoolSwitcher from '@/app/components/school-switcher';

// In your sidebar:
<SchoolSwitcher />
```

### Dimensi8Selector
8 Dimensi Profil Lulusan checkboxes.
```tsx
import Dimensi8Selector from '@/app/components/dimensi-8-selector';

// In your sidebar (show when kurikulum === 'merdeka'):
<Dimensi8Selector />
```

### TigaPengalamanSelector
3 Pengalaman Belajar toggle.
```tsx
import TigaPengalamanSelector from '@/app/components/tiga-pengalaman-selector';

// In your sidebar:
<TigaPengalamanSelector />
```

### PaiModeSelector
PAI special mode panel.
```tsx
import PaiModeSelector from '@/app/components/pai-mode-selector';

// In your sidebar (show when mapel is PAI):
<PaiModeSelector isPaiSubject={isPaiMapel} kurikulum={kurikulum} />
```

---

## 5. Zustand Stores

### useTeacherStore
```typescript
import { useTeacherStore } from '@/lib/stores';

// State
{
  activeSchoolId,    // Currently selected school
  activeClassId,     // Currently selected class
  activeSubjectId,    // Currently selected subject
  activeTahunAjaranId, // Currently selected tahun ajaran
  schools,           // All schools user has access to
  kurikulumPrefs,     // Kurikulum preference per school
}

// Actions
setActiveSchool(schoolId)
setActiveClass(classId)
setActiveSubject(subjectId)
setActiveTahunAjaran(id, semester)

// Helpers
getActiveSchool()  // Returns school object
getActiveSubject()  // Returns subject object
getActiveKurikulum() // Returns 'merdeka' | 'k13' | 'kbc' | 'hybrid'
```

### useKurikulumStore
```typescript
import { useKurikulumStore } from '@/lib/stores';

// State
{
  selectedDimensi8: ['imtaq', 'kreatif', ...],  // Selected 8 dimensi
  useTigaPengalaman: true,                        // 3 pengalaman toggle
  selectedPengalaman: ['memahami', 'mengaplikasi', 'merefleksikan'],
  paiModeEnabled: true,
  paiIntegration: 'hybrid_kbc' | 'spiritual_only' | 'none',
}

// Actions
toggleDimensi8(key)
setUseTigaPengalaman(value)
togglePengalaman(key)

// Serialize for API
serializeForAPI() // Returns { dimensi8, tiga_pengalaman, pengalaman_keys, pai_mode, fase }
```

---

## 6. New Document Types in guru_administrasi

| tipe_dokumen | Description |
|--------------|-------------|
| `rpp` | Rencana Pelaksanaan Pembelajaran |
| `modul_ajar` | Modul Ajar |
| `silabus` | Silabus Semester |
| `lkpd` | Lembar Kerja Peserta Didik |
| `laporan_lkpd` | Laporan LKPD |
| `atp` | Alur Tujuan Pembelajaran (NEW) |
| `prota` | Program Tahunan (NEW) |
| `prosem` | Program Semester (NEW) |

---

## 7. Database Schema Changes

### New Tables
- `user_school_assignments` - Junction for user ↔ school
- `teacher_subject_assignments` - Junction for user ↔ subject
- `teacher_class_assignments` - Junction for user ↔ class

### New Columns in guru_administrasi
- `school_id`, `class_id`, `subject_id` - Foreign keys
- `dimensi8` - Array of selected dimensions
- `tiga_pengalaman` - Boolean flag
- `pai_mode` - PAI integration mode
- `jenjang`, `fase` - Academic context

---

## 8. Quick Start Checklist

- [ ] Run database migration
- [ ] Run `npx prisma generate`
- [ ] Import stores in dashboard: `import { useTeacherStore, useKurikulumStore } from '@/lib/stores'`
- [ ] Add `SchoolSwitcher` to sidebar
- [ ] Add `Dimensi8Selector` and `TigaPengalamanSelector` when kurikulum === 'merdeka'
- [ ] Add `PaiModeSelector` when mapel is PAI
- [ ] Update document generation API calls to include Deep Learning context
- [ ] Create school assignments for existing users

---

## 9. Example: Generate Modul Ajar with Deep Learning

```typescript
async function generateModulAjar(formData: any) {
  const teacherStore = useTeacherStore.getState();
  const kurikulumStore = useKurikulumStore.getState();
  const deepLearning = kurikulumStore.serializeForAPI();

  const activeSchool = teacherStore.getActiveSchool();
  const activeSubject = teacherStore.getActiveSubject();

  const payload = {
    tipe: 'modul',
    mapel: activeSubject?.nama_mapel || formData.mapel,
    kelas: formData.kelas,
    kurikulum: formData.kurikulum,
    topik: formData.topik,
    tujuan: formData.tujuan,
    // School context
    school_id: teacherStore.activeSchoolId,
    school_name: activeSchool?.nama_sekolah,
    school_npsn: activeSchool?.npsn,
    school_address: activeSchool?.alamat,
    // Deep Learning context
    ...deepLearning,
  };

  const res = await fetch('/api/generate-administrasi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return await res.json();
}
```

---

## 10. Support

For issues or questions, check:
1. `PLAN-deep-learning-multi-school.md` - Full architecture plan
2. `lib/stores/teacherStore.ts` - Store implementation
3. `app/api/generate-administrasi/route.ts` - API implementation
