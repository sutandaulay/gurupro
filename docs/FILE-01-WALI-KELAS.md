# File 01: Relasi Wali Kelas - Dokumentasi Implementasi

## Ringkasan

Implementasi fondasi relasi wali kelas untuk fitur e-Raport GuruPRO AI. File ini membuat tabel `wali_kelas_assignments` sebagai PostgreSQL app-side (bukan Payload collection) untuk mengelola penugasan wali kelas per kelas per periode ajaran.

## File yang Dibuat

### 1. Migration SQL
- **`migrations/03_create_wali_kelas_assignments.sql`**
  - Tabel `wali_kelas_assignments` dengan FK ke `classes.id`
  - Indexes untuk query umum
  - Unique constraint: 1 wali kelas aktif per kelas per periode
  - Trigger auto-update `updated_at`

### 2. TypeScript Types & Zod Schemas
- **`lib/schemas/wali-kelas.ts`**
  - `CreateWaliKelasAssignmentSchema` - Validasi input penugasan
  - `UpdateWaliKelasAssignmentStatusSchema` - Validasi status update
  - `GetWaliKelasAssignmentsSchema` - Validasi query filters
  - `WaliKelasAssignmentSchema` - Full response schema
  - Type exports untuk use di seluruh aplikasi

### 3. Application Layer Functions
- **`lib/wali-kelas.ts`**
  - `assignWaliKelas()` - Menugaskan guru sebagai wali kelas
  - `reassignWaliKelas()` - Ganti wali kelas (deactivate lama, activate baru)
  - `updateWaliKelasStatus()` - Update status assignment
  - `getWaliKelasAssignments()` - Query assignments
  - `getWaliKelasAssignmentsWithDetails()` - Query dengan detail guru & kelas
  - `getWaliKelasForKelas()` - Get wali kelas untuk kelas tertentu
  - `getKelasForWaliKelas()` - Get kelas untuk wali kelas tertentu
  - `getGuruOptionsForSchool()` - Dropdown options untuk UI
  - `backfillWaliKelasAssignments()` - One-time migration script

### 4. API Routes
- **`app/api/wali-kelas/route.ts`** - GET list, POST create
- **`app/api/wali-kelas/[id]/route.ts`** - PUT update, DELETE remove
- **`app/api/wali-kelas/guru-options/route.ts`** - GET guru dropdown
- **`app/api/wali-kelas/backfill/route.ts`** - GET trigger backfill

### 5. Migration Script
- **`scripts/run-wali-kelas-migration.ts`** - Run migration via CLI

### 6. Database Init
- **`lib/db.ts`** - Added migration #27 for auto-init on startup

## Struktur Tabel

```sql
wali_kelas_assignments (
  id UUID PRIMARY KEY,
  kelas_id UUID REFERENCES classes(id),
  wali_kelas_member_id UUID REFERENCES institution-members(id),
  tahun_ajaran VARCHAR(9),  -- "2025/2026"
  semester VARCHAR(6),       -- 'ganjil' | 'genap'
  status VARCHAR(10),        -- 'aktif' | 'nonaktif'
  ditugaskan_pada TIMESTAMP,
  ditugaskan_oleh UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Validasi Lintas Sistem

Validasi dilakukan di application layer karena FK tidak bisa lintas Postgres-Payload:

1. **Kelas exists** - Cek `classes.id` ada
2. **Member is guru** - Cek `institution-members` dengan `role='guru'`
3. **Unique assignment** - Cek tidak ada assignment aktif lain untuk kelas+periode

## API Endpoints

### GET /api/wali-kelas
Query params:
- `kelas_id` - Filter by class
- `wali_kelas_member_id` - Filter by guru
- `tahun_ajaran` - Format YYYY/YYYY
- `semester` - ganjil | genap
- `status` - aktif | nonaktif
- `school_id` - Filter by school
- `include_details` - Include guru & kelas details
- `guru_options` - Get dropdown options

### POST /api/wali-kelas
```json
{
  "kelas_id": "uuid",
  "wali_kelas_member_id": "uuid",
  "tahun_ajaran": "2025/2026",
  "semester": "ganjil",
  "reassign": false
}
```

### PUT /api/wali-kelas/[id]
```json
{
  "status": "aktif" | "nonaktif"
}
```

### DELETE /api/wali-kelas/[id]
Hanya untuk assignment non-aktif.

### GET /api/wali-kelas/guru-options?school_id=xxx
Returns guru list for dropdown.

### GET /api/wali-kelas/backfill?tahun_ajaran=2025/2026&semester=ganjil
One-time migration untuk populate data dari `classes.wali_kelas` text.

## Backfill Process

1. Query semua kelas dengan `wali_kelas` text terisi
2. Match nama ke `institution-members` dengan role='guru'
3. Jika 1 match: buat assignment
4. Jika 0 atau multiple matches: catat untuk review manual

## Checklist Kriteria Selesai

- [x] Tabel `wali_kelas_assignments` berhasil dibuat di PostgreSQL app-side
- [x] FK ke `classes.id` dan constraint unique terdefinisi
- [x] `assignWaliKelas` menolak jika bukan role guru
- [x] Helper functions terimplementasi
- [x] API routes terimplementasi
- [x] TypeScript compiles tanpa error untuk file baru
- [ ] Backfill dijalankan dan hasil review manual
- [x] Kolom `wali_kelas` (text) di `classes` tetap ada (tidak dihapus)
- [x] Tidak ada collection Payload baru bernama `kelas`

## Dependencies untuk File Berikutnya

File 02 dan seterusnya dapat menggunakan:
- `import { assignWaliKelas, getWaliKelasForKelas, getKelasForWaliKelas } from '@/lib/wali-kelas'`
- API routes di `/api/wali-kelas`
