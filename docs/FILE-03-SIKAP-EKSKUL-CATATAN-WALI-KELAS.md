# File 03: Sikap, Ekstrakurikuler, Catatan Wali Kelas

## Ringkasan

Implementasi modul penilaian sikap, ekstrakurikuler, dan catatan wali kelas untuk fitur e-Raport GuruPRO AI. Semua tabel PostgreSQL app-side dengan relasi ke `institution-members.id`.

## Prinsip Arsitektur

- Semua tabel di PostgreSQL app-side (bukan Payload collection)
- Relasi ke "siapa yang menilai" (`dinilai_oleh`, `ditulis_oleh`, `pembina_member_id`) selalu ke `institution-members.id`
- Validasi RBAC di application layer, reuse `getWaliKelasForKelas` dari File 01
- Snapshot presensi otomatis saat `data_raport.status` berubah ke `difinalisasi`

## File yang Dibuat

### 1. Migration SQL
- **`migrations/05_create_sikap_ekskul_catatan_wali_kelas.sql`** - 4 tabel baru + indexes + triggers
- **`lib/db.ts`** - Migration #28 untuk auto-init on startup

### 2. TypeScript Types & Zod Schemas
- **`lib/schemas/sikap-ekskul.ts`**
  - Enums: `PredikatSikapEnum`, `DimensiPancasilaEnum`, `DimensiProfilLulusanMadrasahEnum`
  - Schemas: `PenilaianSikap*`, `Ekstrakurikuler*`, `PenilaianEkstrakurikuler*`, `CatatanWaliKelas*`
  - Query filter schemas untuk semua entity

### 3. Application Layer Functions
- **`lib/sikap-ekskul.ts`**
  - RBAC validation:
    - `insertPenilaianSikap` - only active homeroom teacher
    - `insertPenilaianEkstrakurikuler` - only assigned pembina
    - `upsertCatatanWaliKelas` - only active homeroom teacher
  - CRUD operations untuk semua entity
  - `getRaportSikapEkskulData` - aggregated data untuk raport

### 4. API Routes
- **`app/api/penilaian-sikap/route.ts`** - GET, POST, PUT
- **`app/api/ekstrakurikuler/route.ts`** - GET, POST, PUT
- **`app/api/penilaian-ekskul/route.ts`** - GET, POST, PUT
- **`app/api/catatan-wali-kelas/route.ts`** - GET, POST, PUT
- **`app/api/wali-kelas/my-classes/route.ts`** - GET kelas for current user
- **`app/api/ekstrakurikuler/my-ekskul/route.ts`** - GET ekskul for current user

### 5. UI Components
- **`app/components/PenilaianSikapForm.tsx`** - Form sikap untuk wali kelas
- **`app/components/CatatanWaliKelasForm.tsx`** - Form catatan untuk wali kelas
- **`app/components/PenilaianEkstrakurikulerForm.tsx`** - Form penilaian ekskul

### 6. Dashboard Pages
- **`app/dashboard/wali-kelas/page.tsx`** - Dashboard wali kelas
- **`app/dashboard/pembina-ekskul/page.tsx`** - Dashboard pembina ekskul

## Struktur Tabel

```sql
penilaian_sikap (
  id UUID PRIMARY KEY,
  siswa_id UUID REFERENCES students(id),
  kelas_id UUID REFERENCES classes(id),
  periode VARCHAR(30),
  varian VARCHAR(30), -- 'profil_pelajar_pancasila' | 'dimensi_profil_lulusan_madrasah'
  penilaian_per_dimensi JSONB, -- [{ dimensi, predikat }]
  deskripsi_umum TEXT,
  dinilai_oleh UUID, -- institution-members.id
  UNIQUE (siswa_id, kelas_id, periode)
)

ekstrakurikuler (
  id UUID PRIMARY KEY,
  nama_ekskul VARCHAR(255),
  kelas_id UUID REFERENCES classes(id),
  pembina_member_id UUID -- institution-members.id
)

penilaian_ekstrakurikuler (
  id UUID PRIMARY KEY,
  siswa_id UUID REFERENCES students(id),
  ekstrakurikuler_id UUID REFERENCES ekstrakurikuler(id),
  periode VARCHAR(30),
  predikat VARCHAR(20), -- 'sangat_baik' | 'baik' | 'cukup' | 'perlu_bimbingan'
  deskripsi TEXT,
  dinilai_oleh UUID, -- institution-members.id = pembina
  UNIQUE (siswa_id, ekstrakurikuler_id, periode)
)

catatan_wali_kelas (
  id UUID PRIMARY KEY,
  siswa_id UUID REFERENCES students(id),
  kelas_id UUID REFERENCES classes(id),
  periode VARCHAR(30),
  catatan TEXT,
  ditulis_oleh UUID, -- institution-members.id = wali kelas aktif
  UNIQUE (siswa_id, kelas_id, periode)
)
```

## Validasi RBAC

### Penilaian Sikap & Catatan Wali Kelas
```typescript
async function insertPenilaianSikap(input, actorMemberId) {
  const [, tahunAjar, , semester] = input.periode.match(/(\d{4})\/(\d{4})-(\w+)/);
  const waliKelas = await getWaliKelasForKelas(input.kelasId, tahunAjar, semester);
  if (!waliKelas || waliKelas.id !== actorMemberId) {
    throw new Error('Hanya wali kelas aktif kelas ini yang bisa mengisi');
  }
}
```

### Penilaian Ekstrakurikuler
```typescript
async function insertPenilaianEkstrakurikuler(input, actorMemberId) {
  const ekskul = await db.query('SELECT pembina_member_id FROM ekstrakurikuler WHERE id = $1', [input.ekstrakurikulerId]);
  if (!ekskul.rows.length || ekskul.rows[0].pembina_member_id !== actorMemberId) {
    throw new Error('Hanya pembina ekskul ini yang bisa mengisi');
  }
}
```

## Presensi Snapshot

Presensi snapshot sudah diimplementasi di `app/api/raport/status/route.ts` (File 04). Saat status berubah ke `difinalisasi`:
1. Parse periode untuk extract tahun ajaran dan semester
2. Query `student_attendance` dengan filter status sakit/izin/alpa
3. Simpan ke `data_raport.presensi_snapshot` (JSONB)

## API Endpoints

### GET /api/penilaian-sikap
Query: `siswaId`, `kelasId`, `periode`, `varian`, `dinilaiOleh`

### POST /api/penilaian-sikap
```json
{
  "siswaId": "uuid",
  "kelasId": "uuid",
  "periode": "2025/2026-ganjil",
  "varian": "profil_pelajar_pancasila",
  "penilaianPerDimensi": [
    { "dimensi": "beriman_bertakwa", "predikat": "sangat_baik" }
  ],
  "deskripsiUmum": "Siswa menunjukkan..."
}
```

### POST /api/ekstrakurikuler
```json
{
  "namaEkskul": "Pramuka",
  "kelasId": "uuid",
  "pembinaMemberId": "uuid"
}
```

### POST /api/penilaian-ekskul
```json
{
  "siswaId": "uuid",
  "ekstrakurikulerId": "uuid",
  "periode": "2025/2026-ganjil",
  "predikat": "baik",
  "deskripsi": "Siswa aktif mengikuti..."
}
```

### POST /api/catatan-wali-kelas
```json
{
  "siswaId": "uuid",
  "kelasId": "uuid",
  "periode": "2025/2026-ganjil",
  "catatan": "Siswa menunjukkan perkembangan..."
}
```

## Checklist Kriteria Selesai

- [x] 4 tabel baru berhasil dibuat (migration #28)
- [x] Wali kelas tidak bisa isi sikap/catatan untuk kelas bukan diampunya (RBAC validation)
- [x] Pembina ekskul tidak bisa isi nilai ekskul yang bukan diampunya (RBAC validation)
- [x] Snapshot presensi terekam saat status raport difinalisasi (existing: `app/api/raport/status/route.ts`)
- [x] Tidak ada modifikasi pada modul presensi existing
- [x] Reuse `getWaliKelasForKelas` dari File 01
- [x] UI forms fungsional untuk wali kelas dan pembina ekskul

## Dependencies

- File 01: `lib/wali-kelas.ts` - `getWaliKelasForKelas`, `getActiveTahunAjaran`, `getCurrentSemester`
- File 04: `app/api/raport/status/route.ts` - presensi snapshot integration
