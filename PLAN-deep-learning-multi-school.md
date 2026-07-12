# PLAN: Modul Ajar Generator — Update Deep Learning + Multi-School Multi-Tenancy

## Status: PLANNING

---

## RINGKASAN EKSEKUTIF

Aplikasi GuruPRO saat ini memiliki **3 gap arsitektural besar**:

1. **Multi-School tidak didukung** — user hanya bisa 1 sekolah (1:1 FK schools.user_id)
2. **Dokumen tidak terikat konteks** — Modul Ajar/RPP tidak punya school_id, class_id, subject_id
3. **Tidak ada 8 Dimensi Profil Lulusan & 3 Pengalaman Belajar** — fitur baru Kurikulum 8334

User kita adalah **guru yang mengajar di banyak sekolah, banyak mapel, banyak kelas** — ini sudah pasti kebutuhan nyata.

---

## DIAGNOSIS DETAIL

### A. Database Schema — Current State

```
users (1) ────(1:1 BUG)────► schools
                            │
                            ├──(1:N)──► classes
                            ├──(1:N)──► subjects
                            └──(1:N)──► schedules

guru_administrasi ──────────(user_id SAJA)──────► users
  │ ❌ Tidak ada school_id, class_id, subject_id
  └── Dokumen "y孤儿" — melayang tanpa konteks

question_banks ──────────────(user_id SAJA)──────► users
  │ ❌ mata_pelajaran = free text, bukan FK
  └── Tidak terikat sekolah/mapel

teacher_journals ───────────(user_id + class_id + subject_id)──────► but NO school_id
  └── Tahun ajaran GLOBAL (requireActiveTahunAjaran() tanpa filter sekolah)

tahun_ajaran.sekolah_id = OPTIONAL
  └── Sistem punya 1 tahun ajaran global, bukan per-sekolah
```

### B. UI State — Current State

```
Sidebar.tsx ────(local useState SAJA)──► formData
  │ ❌ Tidak terhubung ke classes/subjects dari dashboard
  │ ❌ kelas = dropdown hardcoded (1-12), bukan dari DB sekolah
  │ ❌ mapel = dropdown hardcoded ~50 item, bukan dari DB sekolah
  │ ❌ Tidak ada context switcher sekolah
  │ ❌ Profil Pelajar Pancasila = static badge, BUKAN checkbox
  │ ❌ Tidak ada opsi 8 Dimensi
  │ ❌ Tidak ada opsi 3 Pengalaman Belajar
  │ ❌ "PAI" = hanya 1 option di dropdown, tanpa special mode

dashboard/page.tsx ────(local useState)──► schools[], selectedSchoolId, classes[], subjects[]
  │ ✅ Ini BAIK — sudah ada struktur
  │ ❌ Tapi TIDAK digunakan untuk generate soal/modul
```

### C. AI Generation — Current State

```
POST /api/generate-administrasi
  Body: { tipe, mapel, kelas, kurikulum, topik, tujuan }
  │ ❌ TIDAK ada userId → tidak bisa ambil sekolah
  │ ❌ TIDAK ada schoolId, classId, subjectId
  │ ❌ Prompt tidak include: nama sekolah, NPSN, alamat
  │ ❌ Prompt tidak include: 8 Dimensi Profil Pelajar
  │ ❌ Prompt tidak include: 3 Pengalaman Belajar (Memahami/Mengaplikasi/Merefleksi)
  │ ❌ Prompt tidak include: PAI-specific (Kepka BKPDM, integrasi spiritual)
  │ ❌ Tidak ada sistem prompt untuk administrasi
  │ ❌ GURUPRO_SYSTEM_PROMPT hanya untuk SOAL, bukan dokumen
```

---

## DESAIN ARSITEKTUR BARU

### Option: Full Multi-Tenancy vs Layered Approach

**Dipilih: Layered Approach** — tidak perlu ubah semua tabel sekaligus. Perubahan bertahap.

Alasan:
- Tabel `schools` sudah punya `user_id` FK → tinggal ubah 1:1 → 1:N
- Dokumen baru (`guru_administrasi`) bisa langsung pakai kolom baru
- UI bisa bertahap dari "single school mode" → "multi school mode"
- AI prompts diupdate bertahap per dokumen

---

## TAHAPAN IMPLEMENTASI

### PHASE 1: Database Schema Migration

#### 1.1 Ubah User-School dari 1:1 → 1:N
```sql
-- Hapus FK unik di schools.user_id
-- Tambah junction table

CREATE TABLE user_school_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  tahun_ajaran_id UUID REFERENCES tahun_ajaran(id),
  is_wali_kelas BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, school_id, tahun_ajaran_id)
);

-- schools.user_id tetap ADA untuk backward compat (sekolah pertama)
-- schools menjadi NOT REQUIRED di junction table
```

#### 1.2 Tambah kolom anchor ke guru_administrasi
```sql
ALTER TABLE guru_administrasi
  ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  ADD COLUMN subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  ADD COLUMN tahun_ajaran_id UUID REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
  ADD COLUMN semester VARCHAR(20),
  ADD COLUMN kurikulum VARCHAR(50);

-- Migration: populate dari existing data berdasarkan user.namaSekolah match
```

#### 1.3 Tambah kolom anchor ke question_banks
```sql
ALTER TABLE question_banks
  ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
```

#### 1.4 Tahun Ajaran per sekolah
```sql
-- schools.user_id dihapus uniqueness constraint
-- tahun_ajaran.sekolah_id dijadikan NOT NULL

ALTER TABLE tahun_ajaran
  ALTER COLUMN sekolah_id SET NOT NULL;
```

#### 1.5 Teacher-Subject Assignment (untuk mapping guru → mapel)
```sql
CREATE TABLE teacher_subject_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  tahun_ajaran_id UUID REFERENCES tahun_ajaran(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, school_id, subject_id, tahun_ajaran_id)
);
```

---

### PHASE 2: Zustand Global State Store

#### 2.1 Buat teacherStore
```typescript
// lib/stores/teacherStore.ts
interface TeacherContext {
  // Current active context
  activeSchoolId: string | null;
  activeClassId: string | null;
  activeSubjectId: string | null;
  activeTahunAjaranId: string | null;
  activeSemester: 'ganjil' | 'genap' | null;

  // Full data
  schools: School[];
  classes: Record<string, Class[]>; // key = schoolId
  subjects: Record<string, Subject[]>; // key = schoolId
  tahunAjaran: Record<string, TahunAjaran[]>; // key = schoolId

  // Kurikulum prefs per school
  kurikulumPrefs: Record<string, 'merdeka' | 'kbc' | 'k13' | 'hybrid'>;

  // Actions
  setActiveSchool: (schoolId: string) => void;
  setActiveClass: (classId: string) => void;
  setActiveSubject: (subjectId: string) => void;
  setActiveTahunAjaran: (id: string, semester: string) => void;
  setKurikulumPref: (schoolId: string, kurikulum: string) => void;
  loadSchoolData: (schoolId: string) => Promise<void>;
}
```

#### 2.2 Buat KurikulumContext (untuk 8 Dimensi & 3 Pengalaman)
```typescript
// lib/stores/kurikulumStore.ts
interface KurikulumOptions {
  // 8 Dimensi Profil Lulusan
  dimensi8: {
    imtaq: boolean;           // Beriman, Bertakwa, Berakhlak Mulia
    gotongRoyong: boolean;    // Gotong Royong
    bernalarKritis: boolean;  // Bernalar Kritis
    kreatif: boolean;         // Kreatif
    mandiri: boolean;         // Mandiri
    bergotongRoyong: boolean; //葯 Nanti dipakai
  };

  // 3 Pengalaman Belajar
  tigaPengalaman: {
    memahami: boolean;  // Memahami (C2)
    mengaplikasi: boolean; // Mengaplikasi (C3)
    merefleksikan: boolean; // Merefleksikan (C4+)
  };

  // PAI Special Mode
  paiMode: {
    enabled: boolean;
    integration: 'spiritual_only' | 'hybrid_kbc' | 'none';
    kepkaRef: string; // "Kepka BKPDM No. 020/2026"
  };
}
```

---

### PHASE 3: Sidebar UI Overhaul

#### 3.1 School Context Switcher
- Tambah dropdown di atas Sidebar: "Pilih Sekolah Aktif"
- Tampilkan: logo sekolah + nama sekolah + NPSN
- Switching sekolah → update semua dropdown (kelas, mapel) dari store

#### 3.2 Dynamic Subject & Class Dropdowns
- Hapus hardcoded dropdown mapel/kelas
- Ambil dari `teacherStore.classes[schoolId]` dan `teacherStore.subjects[schoolId]`
- Untuk PAI Madrasah, filter subjects yang berniat di-group

#### 3.3 8 Dimensi Checkboxes
```
☐ 1. Beriman, Bertakwa, Berakhlak Mulia (Imtaq)
☐ 2. Berkebinekaan Global
☐ 3. Bergotong Royong
☐ 4. Merdeka
☐ 5. Kreatif
☐ 6. Bernalar Kritis
☐ 7. Mengakar pada Budi Pekerti Luhur
☐ 8. Kreativitas (New — Deep Learning)
```
State tersimpan di kurikulumStore, passed ke AI prompt.

#### 3.4 3 Pengalaman Belajar Toggle
```
Struktur Kegiatan Inti:
○ Tidak Gunakan (default lama)
○ Gunakan 3 Pengalaman Belajar (Deep Learning)
  ├─ □ Memahami (Understand)
  ├─ □ Mengaplikasi (Apply)
  └─ □ Merefleksikan (Reflect)
```

#### 3.5 PAI Special Mode Panel
Muncul saat mapel = PAI / Madrasah:
```
Mode PAI:
○ Standar ○ Hybrid (KBC)

Jika Hybrid dipilih:
☐ Integrasi Nilai Spiritual Otomatis
☐ Gunakan Referensi Kepka BKPDM No. 020/2026
```

---

### PHASE 4: AI Prompt Engineering Update

#### 4.1 Modul Ajar Prompt — Tambahkan Konteks

**SEBELUM:**
```
Spesifikasi Modul Ajar:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas}
- Topik / Materi Pokok: ${topik}
```

**SESUDAH:**
```
Identitas Sekolah:
- Nama Sekolah: ${schoolName}
- NPSN: ${npsn}
- Alamat: ${alamat}
- Nama Guru: ${teacherName}

Spesifikasi Modul Ajar:
- Mata Pelajaran: ${mapel}
- Kelas: ${kelas} (Fase ${fase})
- Kurikulum: ${kurikulumLabel}
- Topik / Materi Pokok: ${topik}
${tahunAjaran ? `- Tahun Ajaran: ${tahunAjaran}, Semester ${semester}` : ''}

Profil Pelajar Pancasila — 8 Dimensi:
Pilih dimensi yang relevan: ${selected8Dimensi.join(', ')}

Struktur Kegiatan Inti (Deep Learning):
${if (tigaPengalaman) ?
  `Wajib menggunakan struktur 3 Pengalaman Belajar:
  1. MEMAHAMI — Eksplorasi konsep (${memahami ? 'wajib' : 'opsional'})
  2. MENGAPLIKASI — Latihan penerapan (${mengaplikasi ? 'wajib' : 'opsional'})
  3. MEREFLEKSIKAN — Refleksi dan transfer (${merefleksikan ? 'wajib' : 'opsional'})
  Setiap fase harus memiliki kegiatan yang substantive, bukan hanya ceremonial.` : ''}

${if (paiMode === 'hybrid') ?
  `KETENTUAN KHUSUS GURU PAI:
  - Merujuk pada Kepka BKPDM No. 020/2026
  - Integrasikan nilai spiritual (imtaq, akhlak, hablumminallah, habluminannas)
  - Gunakan pendekataan Kurikulum Berbasis Cinta (KBC)` : ''}
```

#### 4.2 RPP Prompt — Deep Learning Format
```
RPP harus menggunakan format ABCD + 3 Pengalaman Belajar:
Fase 1: MEMAHAMI
  - Aktivitas: eksplorasi, tanya jawab, demonstrasi
  - Produk: catatan konsep, peta pikiran

Fase 2: MENGAPLIKASI
  - Aktivitas: simulasi, latihan, proyek mini
  - Produk: hasil kerja, LKPD

Fase 3: MEREFLEKSIKAN
  - Aktivitas: diskusi reflektif, presentasi, assessment diri
  - Produk: refleksi tertulis, portofolio
```

#### 4.3 Silabus/ATP — Update ke 8 Dimensi
```
Silabus harus mencantumkan:
- Capaian Pembelajaran (CP) terbaru
- Tujuan Pembelajaran (TP)
- Profil Pelajar Pancasila — 8 Dimensi yang ditarget
- Alur Tujuan Pembelajaran (ATP) per semester
```

---

### PHASE 5: New Document Types — Prota & Prosem

#### 5.1 Prota Generator (Program Tahunan)
```typescript
// app/api/generate-prota/route.ts
interface GenerateProtaInput {
  school_id: string;
  tahun_ajaran_id: string;
  jenjang: string;
  kurikulum: string;
  subjects: string[]; // subject IDs
  class_id: string;
}

// Output: Tabel Prota dengan kolom
// | No | Mata Pelajaran | Kelas | Semester | Alokasi JP |
```

#### 5.2 Prosem Generator (Program Semester)
```typescript
// app/api/generate-prosem/route.ts
interface GenerateProsemInput {
  school_id: string;
  tahun_ajaran_id: string;
  jenjang: string;
  kurikulum: string;
  subject_id: string;
  class_id: string;
  semester: 'ganjil' | 'genap';
  minggu_efektif: number;
}

// Output: Tabel Prosem mingguan
// | Minggu | Bulan | Materi | JP | Keterangan |
```

---

### PHASE 6: Supporting Documents Sync (Silabus/ATP)

#### 6.1 Silabus Generator — Update
```typescript
// app/api/generate-silabus/route.ts
// Include: 8 Dimensi, Capaian Pembelajaran terbaru, Fase, TP
```

#### 6.2 ATP Editor — Full CRUD
```typescript
// app/api/atp/route.ts — GET, POST, PUT, DELETE
// app/atp-editor/page.tsx — Full ATP editor UI
// table: guru_administrasi with tipe_dokumen = 'atp'
```

---

## FILE YANG PERLU DIUBAH

### Database Migration
```
prisma/schema.prisma                    [REVISI BESAR]
```

### New Files
```
lib/stores/teacherStore.ts              [NEW]
lib/stores/kurikulumStore.ts            [NEW]
app/api/school-assignments/route.ts     [NEW]
app/api/teacher-subjects/route.ts       [NEW]
app/api/generate-prota/route.ts         [NEW]
app/api/generate-prosem/route.ts        [NEW]
app/api/atp/route.ts                    [NEW]
app/atp-editor/page.tsx                 [NEW]
app/prota-editor/page.tsx               [NEW]
app/prosem-editor/page.tsx              [NEW]
```

### Modified Files
```
prisma/schema.prisma                    [ADD: junction tables, FK columns]
app/components/Sidebar.tsx               [OVERHAUL: school switcher, 8 dimensi, 3 pengalaman]
app/dashboard/page.tsx                  [ADD: integrate teacherStore]
app/api/generate-administrasi/route.ts  [ADD: school context, updated prompts]
lib/gemini/system-prompt.ts             [ADD: administrasi system prompt]
lib/ai/prompts.ts                       [UPDATE: all document prompts]
lib/selesai-mengajar/types.ts           [UPDATE: add school context]
lib/db.ts                               [UPDATE: requireActiveTahunAjaran with school filter]
```

---

## KOMPATIBILITAS & MIGRASI

### Backward Compatibility Strategy

1. **`schools.user_id`**: constraint uniqueness DIHAPUS, TAPI kolom tetap ada
   - Sekolah pertama user auto-create di `user_school_assignments`
   - Existing data tidak perlu migrasi manual

2. **`guru_administrasi`**: kolom baru = NULLABLE
   - Existing dokumen tetap accessible
   - Dokumen baru auto-filled dengan context

3. **`users.nama_sekolah`**: deprecated, tapi tetap dibaca
   - Untuk backward compat dengan data lama

4. **Sidebar**: default ke "single school mode"
   - Jika `schools.length === 1`, auto-select itu
   - Jika `schools.length > 1`, tampilkan switcher

---

## ESTIMASI WAKTU & COMPLEXITY

| Phase | Complexity | Est. Effort |
|-------|-----------|-------------|
| Phase 1: DB Schema | HIGH | 2-3 days |
| Phase 2: Zustand Store | MEDIUM | 1-2 days |
| Phase 3: Sidebar UI | HIGH | 2-3 days |
| Phase 4: AI Prompts | MEDIUM | 1-2 days |
| Phase 5: Prota/Prosem | MEDIUM | 2-3 days |
| Phase 6: ATP Editor | MEDIUM | 2-3 days |

**Total: ~10-16 hari kerja** (bisa lebih cepat jika parallel)

---

## KEPUTUSAN YANG DIBUTUHKAN DARI USER

1. **Junction table `user_school_assignments`** — setuju dengan struktur ini?
2. **`guru_administrasi`** — kolom baru nullable (safe) atau langsung NOT NULL?
3. **AI prompts** — mau update bertahap per dokumen atau sekalian semua?
4. **Prota/Prosem** — jadi prioritas tinggi atau bisa ditunda?
5. **ATP Editor** — perlu full CRUD atau cukup generate + update progress?
