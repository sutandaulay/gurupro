# Audit Performa GuruPRO AI
**Tanggal Audit:** 2026-07-24  
**Environment:** Development (localhost)  
**Teknologi:** Next.js 16.2.9, Payload CMS 3.x, PostgreSQL + Drizzle ORM, TypeScript

---

## Ringkasan Eksekutif

| Temuan | Dampak | Prioritas |
|--------|--------|-----------|
| **Total 90 query Drizzle** dengan banyak `SELECT *` dan potensi N+1 pattern | Query tidak efisien, bottleneck pada database | 🔴 Tinggi |
| **Tidak ada caching layer** (Next.js Cache API, React Cache, Redis, Upstash) | Setiap request hit database, AI generation repetitif | 🔴 Tinggi |
| **Mix ORM tanpa config manajemen** (Prisma + Drizzle manual migration) | Schema drift, sulit tracking index & migration | 🟡 Sedang |
| **Memory usage 1.5GB** untuk Next.js dev server + 8GB total RAM системы | Sistem beroperasi di atas kapasitas optimal | 🔴 Tinggi |
| **next.config minimal** tanpa cache headers / experimental optimizations | Kehilangan optimisasi built-in Next.js | 🟡 Sedang |
| **Indexes sudah cukup di Prisma schema** tapi beberapa tabel besar belum dioptimalkan | Query filter bisa lebih cepat | 🟢 Rendah |

**Total Query Teridentifikasi:** 90 baris query Drizzle across 13 files  
**Endpoint Berat Teridentifikasi:** 5 endpoint (attendance reports, insight, TPG, AI chat, e-Raport)

---

## 1. Inventarisasi Query

### Distribusi Query per File

| File | Jumlah Query | Status |
|------|-------------|--------|
| `app/api/attendance/check-out/route.ts` | 12 | Berat, banyak SELECT * |
| `app/api/attendance/check-in/route.ts` | 11 | Berat, banyak SELECT * |
| `app/api/attendance/insight/route.ts` | 10 | Berat, multiple queries terpisah |
| `app/api/attendance/tpg-reports/route.ts` | 8 | Berat, multiple JOIN-like queries |
| `scripts/auto-close-teaching-session.ts` | 8 | Berat, loop potensi N+1 |
| `app/api/leave-requests/[id]/route.ts` | 8 | Sedang |
| `app/api/attendance/reports/route.ts` | 7 | Berat, SELECT * |
| `app/api/attendance/teaching/start/route.ts` | 6 | Sedang |
| `app/api/leave-requests/route.ts` | 6 | Sedang |
| `app/api/attendance/teaching/end/route.ts` | 6 | Berat |
| `app/api/performance-share/attendance-data/[token]/route.ts` | 4 | Ringan |

### Query Berat Teridentifikasi

#### 🔴 Critical: `app/api/attendance/reports/route.ts`
```typescript
// Line 131: SELECT * tanpa filter spesifik
let institutionQuery = db.select().from(attendanceSummary) as any;
// Dieksekusi kemudian dengan WHERE dinamis
```
**Masalah:** `SELECT *` + tidak ada LIMIT + multiple query terpisah untuk school + institution data.

#### 🔴 Critical: `app/api/attendance/tpg-reports/route.ts`
```typescript
// Lines 87-135: 3 query terpisah untuk data yang saling terkait
const teacherAssignments = await db.select(...) // Query 1
const ownedSchools = await db.select(...) // Query 2
const attendanceData = await db.select(...) // Query 3
const institutions = await db.select(...) // Query 4
const teachingSessions = await db.select(...) // Query 5
```
**Masalah:** 5 query terpisah yang bisa digabung dengan JOIN. Setiap query melakukan scan terpisah.

#### 🔴 Critical: `app/api/attendance/insight/route.ts`
```typescript
// Lines 56-104: Multiple queries untuk akses check + data
const userInstitutionMembers = await db.select(...) // Query 1
const teacherAssignments = await db.select(...) // Query 2
const [cachedInsight] = await db.select(...) // Query 3
const attendanceData = await db.select(...) // Query 4
const fallbackInstitutions = await db.select(...) // Query 5
```
**Masalah:** 5 query untuk satu endpoint. BEKERJA DENGAN AI generation yang tambah 5-10 detik.

#### 🟡 Warning: Potensi N+1 Pattern
```typescript
// scripts/auto-close-teaching-session.ts
for (const session of sessions) {
  const [assignment] = await db.select().from(teacherInstitutionAssignments)... // N+1!
  const [institution] = await db.select().from(institutionsTable)... // N+1!
}
```
**Masalah:** Loop dengan query di dalamnya akan memperburuk performa seiring pertumbuhan data.

### Query dengan SELECT *
- `app/api/attendance/check-in/route.ts:171` - `db.select()` tanpa kolom spesifik
- `app/api/attendance/check-out/route.ts:101` - `db.select()` tanpa kolom spesifik
- `app/api/attendance/devices/[id]/approve/route.ts:27` - `db.select().from(attendanceDevices)`
- `app/api/attendance/insight/route.ts:97` - `db.select()` untuk cachedInsight
- `app/api/attendance/insight/route.ts:382` - `db.select()` dari attendanceInsightsTable
- `app/api/performance-share/attendance-data/[token]/route.ts` - multiple SELECT *

### Query Tanpa LIMIT
Hanya 8 dari 90 query menggunakan `.limit()`:
- `check-in/route.ts:482,537` - `.limit(10)` dan `.limit(20)`
- `check-out/route.ts:386,433,488` - `.limit(1,10,20)`
- `teaching/end/route.ts:86` - `.limit(10)`
- `leave-requests/route.ts:90,102` - `.limit(1)`
- `performance-share/route.ts:168` - `.limit(1)`

**82 query lain tidak ada LIMIT**, berisiko return data massal.

---

## 2. Status Caching

### Caching yang ADA

| Lokasi | Jenis | Data | TTL |
|--------|-------|------|-----|
| `app/api/admin/landing/chatbot/route.ts` | Manual DB Cache (`cms_landing`) | Landing chatbot config | None (manual invalidation) |
| `app/api/admin/landing/features/route.ts` | Manual DB Cache (`cms_landing`) | Landing features | None (manual invalidation) |
| `src/config/ratio-cache.ts` | In-memory module cache | Tokens per poin ratio | Reset on change |
| `app/api/attendance/insight/route.ts:256` | Manual DB insert | AI Insight result | Permanent (no expiry) |

### Caching yang BELUM ADA

| Data | Frequency Change | Recommended Cache | Current |
|------|------------------|-------------------|---------|
| **Data Institusi** | Jarang berubah | `unstable_cache` / Redis / TTL 1 jam | ❌ Tidak ada |
| **Data Siswa/Guru per Institusi** | Sedang | `unstable_cache` / Redis / TTL 30 menit | ❌ Tidak ada |
| **Rekap TPG** | Harian | `unstable_cache` / TTL 1 hari | ❌ Tidak ada |
| **e-Raport Generation** | Per periode | `unstable_cache` / TTL 1 semester | ❌ Tidak ada |
| **AI Performance Report** | On-demand | `unstable_cache` / TTL 1 minggu | ⚠️ Manual DB insert |
| **Dashboard Wali Kelas** | Harian | `unstable_cache` / TTL 1 hari | ❌ Tidak ada |
| **AI Chat History** | Real-time | Redis / TTL 1 jam | ❌ Tidak ada |
| **Attendance Summary** | Real-time | None needed | ❌ Tidak ada |

### Rekomendasi Caching

```typescript
// Contoh implementasi yang DIREKOMENDASIKAN:

// 1. Untuk data institusi (jarang berubah)
import { unstable_cache } from 'next/cache';

export const getInstitutions = unstable_cache(
  async () => {
    return await db.select().from(institutionsTable);
  },
  ['institutions'],
  { revalidate: 3600, tags: ['institutions'] }
);

// 2. Untuk Rekap TPG (harian)
export const getTPGReport = unstable_cache(
  async (teacherId: string, period: string) => {
    // ... heavy query
  },
  ['tpg-reports'],
  { revalidate: 86400, tags: ['tpg', 'attendance'] }
);

// 3. Untuk AI Insight (per Minggu/Bulan)
// Sudah ada manual DB insert, tapi perlu TTL auto-expire
```

---

## 3. Konfigurasi Database

### `drizzle.config.ts`
**TIDAK DITEMUKAN** - Tidak ada konfigurasi Drizzle ORM standar. Semua migrasi di-handle manual di `lib/db.ts` (2.400+ baris raw SQL).

### Prisma Schema (`prisma/schema.prisma` - 804 baris)

**Total Models:** 28 models

| Model | Indexes | Catatan |
|-------|---------|---------|
| `users` | 3 unique (email, whatsapp, username) | PK: id UUID |
| `institutions` | PK: id INTEGER IDENTITY | Tidak ada index lain |
| `schools` | 0 indexes tambahan | PK: id UUID |
| `teacher_attendance` | 0 indexes | Butuh index `(user_id, tanggal)` |
| `teacher_journals` | 0 indexes tambahan | Butuh index `(user_id, tanggal)` |
| `attendance_summary` (drizzle) | Composite PK + 1 index | ✅ Baik |
| `attendance_logs` | 3 indexes | ✅ Baik |
| `leave_requests` | 4 indexes | ✅ Baik |
| `teaching_sessions` | 2 composite indexes | ✅ Baik |
| `laporan_kinerja` | 1 composite index | ✅ Baik |
| `observasi_kinerja` | 1 composite index | ✅ Baik |
| `skp_tahunan` | 1 unique + 1 index | ✅ Baik |

### Drizzle Schema Files

| File | Tabel | Indexes |
|------|-------|---------|
| `lib/schemas/main-schema.ts` | users, institutions, schools | 0 (hanya PK) |
| `lib/schemas/attendance.ts` | institution_members, teacher_institution_assignments, attendance_devices, attendance_logs, attendance_summary, leave_requests, school_teaching_sessions | 9 indexes |
| `lib/schemas/attendance-insight.ts` | attendance_insights | Primary key composite |

### Index yang MUNGKIN KURANG

```sql
-- Butuh ditambahkan di Prisma:
CREATE INDEX IF NOT EXISTS idx_schools_user_id ON schools(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_user_tanggal ON teacher_attendance(user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_teacher_journals_user_tanggal ON teacher_journals(user_id, tanggal);

-- Butuh ditambahkan di Drizzle (institutions):
CREATE INDEX IF NOT EXISTS idx_institutions_name ON institutions(name);
```

### PostgreSQL Indexes (saat ini)
Tidak bisa dijalankan dari environment ini (psql tidak tersedia). Berdasarkan schema Prisma, indexes yang seharusnya ada:
- `user_school_assignments`: 3 indexes
- `duty_assignments`: 3 indexes  
- `teaching_sessions`: 2 indexes
- `lesson_memories`: 1 index composite
- `raport_cache`: 2 indexes
- `absent_alerts`: 2 indexes
- `admin_tasks`: 2 indexes
- `ai_chat_logs`: 1 index composite
- `evidence_log`: 3 indexes
- `pelatihan_guru`: 1 index
- `dokumen_bukti`: 1 index
- `laporan_kinerja`: 1 index composite
- `tahun_ajaran`: 1 index
- `observasi_kinerja`: 1 index composite
- `TokenUsage`: 2 indexes

---

## 4. Response Time Lokal

**Tidak dapat dijalankan** pada environment ini karena memerlukan:
- Akses lokal ke PostgreSQL (`localhost:5432`)
- Menjalankan `next dev` server
- mengakses endpoint via HTTP

Namun berdasarkan **system monitoring sebelumnya**:
- **CPU Usage:** 74,4% (di atas standar 70%)
- **Memory Usage:** 84,4% (di atas standar 75%)
- **Disk Time:** 79,6% (signifikan)
- **Available RAM:** 974 MB dari 8 GB (sangat minim)

**Proses Terberat:**
| Process | Memory | CPU | Catatan |
|---------|--------|-----|---------|
| node (Next.js) | 1.505 MB | 457s | Server dev |
| kilo | 599 MB | 585s | AI assistant |
| chrome | ~1.8 GB total | - | Multiple tabs |
| Code (VS Code) | ~880 MB total | - | Multi-process |
| Explorer.exe | 147 MB | - | 100 threads (mencurigakan) |

**Rekomendasi Response Time Target:**
- Dashboard Guru: < 500ms
- e-Raport: < 1000ms (heavy AI + PDF)
- Rekap TPG: < 800ms
- AI Chat: < 2000ms (depends on LLM)
- Bank Soal: < 600ms

---

## 5. Next.Config

```typescript
// D:\gurupro\next.config.ts (10 baris)
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,  // ⚠️ Risiko produksi
  },
};

export default withPayload(nextConfig);
```

### Kekurangan Konfigurasi

| Fitur | Status | Dampak |
|-------|--------|--------|
| `experimental.cacheComponents` | ❌ Tidak ada | Tidak bisa pakai Next.js Cache API |
| `experimental.taintObjectReference` | ❌ Tidak ada | Potensi memory leak |
| `images.remotePatterns` | ❌ Tidak ada | Gambar eksternal mungkin gagal |
| `headers()` / `cacheControl` | ❌ Tidak ada | Tidak ada cache Control header |
| `compression` | ❌ Tidak ada | Gzip/Brotli mungkin tidak aktif |
| `reactStrictMode` | Default (false untuk Next 16?) | Perlu dicek |

### Konfigurasi Yang DIREKOMENDASIKAN

```typescript
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Fix di produksi
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // Sesuaikan dengan kebutuhan
    ],
  },
  experimental: {
    cacheComponents: true, // WAJIB untuk caching
    taintObjectReference: true,
  },
  // Tidak ada headers di config tapi bisa via route.ts / middleware
};

export default withPayload(nextConfig);
```

---

## Rekomendasi Prioritas

### 🔴 Priority 1 - CRITICAL (Pengaruh Besar, Effort Sedang)

1. **Implementasi Caching Layer**
   - Tambah `experimental.cacheComponents: true` di next.config
   - Implement `unstable_cache()` untuk:
     - Data Institusi (TTL 1 jam)
     - Rekap TPG (TTL 1 hari)
     - Dashboard Wali Kelas (TTL 1 hari)
   - Pertimbangkan Redis/Upstash untuk session & chat history

2. **Refactor Query Berat (N+1 + SELECT *)**
   - `app/api/attendance/reports/route.ts`: Gabung institution + school queries
   - `app/api/attendance/tpg-reports/route.ts`: Gabung 5 queries menjadi 1-2
   - `app/api/attendance/insight/route.ts`: Optimasi akses check queries
   - Ganti semua `db.select()` dengan kolom spesifik

3. **Tambah LIMIT pada Semua Query List**
   - Attendance logs, teaching sessions, dll harus ada pagination

### 🟡 Priority 2 - HIGH (Pengaruh Menengah, Effort Rendah)

4. **Optimasi next.config**
   - Aktifkan `cacheComponents`
   - Tambah `images.remotePatterns`
   - Set `ignoreBuildErrors: false` dan fix TypeScript errors

5. **Tambahkan Indexes yang Kurang**
   - `schools(user_id)`
   - `teacher_attendance(user_id, tanggal)`
   - `teacher_journals(user_id, tanggal)`
   - `institutions(name)`

6. **Connection Pool Tuning**
   - Saat ini menggunakan `Pool` tanpa `max` configuration di `lib/db.ts:9-16`
   - Tambah: `max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000`

### 🟢 Priority 3 - MEDIUM (Pengaruh Kecil, Effort Beragam)

7. **Materialized Views untuk Aggregasi**
   - Buat MV untuk `attendance_summary` harian per guru
   - Buat MV untuk `teaching_sessions` statistik mingguan

8. **Query Logging & Monitoring**
   - Tambah query logger untuk detect slow queries
   - Integrasi denganpg_stat_statements

9. **Batch Operations**
   - `scripts/auto-close-teaching-session.ts`: Ubah loop query menjadi batch IN query

10. **Prisma + Drizzle Schema Alignment**
    - Sinkronkan model yang overlapping (users, institutions, schools)
    - Pertimbangkan consolidate ke satu ORM atau pakai schema-only Drizzle

---

## Appendix: File Yang Disarankan Untuk Review Lanjutan

```
Priority 1 Files:
- D:\gurupro\app\api\attendance\reports\route.ts
- D:\gurupro\app\api\attendance\tpg-reports\route.ts
- D:\gurupro\app\api\attendance\insight\route.ts
- D:\gurupro\app\api\attendance\check-in\route.ts
- D:\gurupro\app\api\attendance\check-out\route.ts
- D:\gurupro\lib\db.ts

Priority 2 Files:
- D:\gurupro\next.config.ts
- D:\gurupro\prisma\schema.prisma
- D:\gurupro\lib\schemas\attendance.ts
- D:\gurupro\scripts\auto-close-teaching-session.ts
```

---

*Laporan ini dibuat dengan audit read-only. Tidak ada kode yang dimodifikasi.*
