# Standar Wajib Pengembangan Fitur AI Generation GuruPRO

> **Versi:** 1.0  
> **Tanggal:** 14 Juli 2026  
> **Status:** WAJIB DIIKUTI untuk semua fitur AI generation baru

---

## 1. Pendahuluan

Dokumen ini menetapkan standar wajib untuk setiap pengembangan fitur AI generation baru di GuruPRO. Tujuannya adalah memastikan:

1. **Konsistensi output** — semua dokumen terlihat profesional dan sesuai layout template
2. **Reliability** — AI tidak menghasilkan teks yang merusak dokumen resmi
3. **Maintainability** — shared utilities menghindari duplikasi validasi per fitur
4. **Scalability** — fitur baru bisa mengikuti pola yang sudah terbukti

---

## 2. Checklist Wajib per Fitur AI Generation

Setiap fitur AI generation baru **WAJIB** memenuhi semua item di bawah ini sebelum di-merge:

### 2.1 Output Schema (Zod)

| # | Checklist | Status |
|---|-----------|--------|
| 2.1.1 | Fitur **TIDAK BOLEH** generate Markdown/teks bebas langsung ke dokumen | ☐ |
| 2.1.2 | Fitur **WAJIB** punya output schema Zod eksplisit di `lib/schemas/` | ☐ |
| 2.1.3 | Setiap field string **WAJIB** punya batas karakter yang realistis | ☐ |
| 2.1.4 | Array fields **WAJIB** punya `.min()` dan `.max()` yang sesuai | ☐ |
| 2.1.5 | Field critical (misal: identitas, nilai) **WAJIB** punya fallback value | ☐ |
| 2.1.6 | Schema didefinisikan di file terpisah (bukan inline di route) | ☐ |

**Contoh Schema yang Benar:**

```typescript
// lib/schemas/contoh-fiturs.ts
import { z } from 'zod';
import { truncateText, withFallback } from '@/lib/ai/validation-utils';

export const contohFiturOutputSchema = z.object({
  identitas: z.object({
    mataPelajaran: z.string().min(1),
    kelas: z.string().min(1),
    fase: z.string(),
  }),
  
  // Field dengan batas karakter
  ringkasan: z.string()
    .max(500, 'Maksimal 500 karakter')
    .transform(val => truncateText(val, 500)), // Enforce dengan truncate
  
  // Array dengan batas items
  temuan: z.array(
    z.string().max(300).transform(val => truncateText(val, 300))
  ).min(1).max(5),
  
  // Field dengan fallback
  catatan: z.string()
    .max(1000)
    .catch('Tidak ada catatan'),
});

// Type inference
export type ContohFiturOutput = z.infer<typeof contohFiturOutputSchema>;
```

**Contoh Schema yang SALAH (TIDAK BOLEH):**

```typescript
// ❌ SALAH - Generate Markdown langsung
const text = await generateAIContent(prompt);
return { konten: text }; // TIDAK ADA SCHEMA

// ❌ SALAH - Schema tapi tanpa batas
const badSchema = z.object({
  deskripsi: z.string(), // Tidak ada .max()
  items: z.array(z.string()), // Tidak ada .min()/.max()
});

// ❌ SALAH - Field tanpa fallback
const anotherBadSchema = z.object({
  ringkasan: z.string(), // Jika AI gagal, ini throw error
});
```

---

### 2.2 Shared Utilities (Wajib Pakai)

| # | Checklist | Status |
|---|-----------|--------|
| 2.2.1 | Validasi string **WAJIB** pakai `truncateText()` dari `lib/ai/validation-utils.ts` | ☐ |
| 2.2.2 | Fallback value **WAJIB** pakai `withFallback()` atau `.catch()` dari shared utils | ☐ |
| 2.2.3 | Schema dengan batas kompleks **WAJIB** pakai `createRobustSchema()` | ☐ |
| 2.2.4 | **DILARANG** membuat fungsi validasi manual di dalam route file | ☐ |

**Shared Utilities yang Tersedia:**

```typescript
// lib/ai/validation-utils.ts

/**
 * Potong teks jika melebihi maxLength
 * @example truncateText("halo dunia", 10) → "halo d..." (7 chars + ellipsis)
 */
export function truncateText(text: string, maxLength: number): string

/**
 * Potong berdasarkan jumlah kata
 * @example truncateWords("satu dua tiga empat", 2) → "satu dua..."
 */
export function truncateWords(text: string, maxWords: number): string

/**
 * Buat Zod schema dengan batas karakter per field
 */
export function withCharLimit<T extends z.ZodTypeAny>(
  schema: T,
  maxLength: number
): z.ZodEffects<T, z.infer<T>, z.infer<T>>

/**
 * Buat field dengan fallback value jika gagal parse
 */
export function withFallback<T extends z.ZodTypeAny>(
  schema: T,
  fallback: z.infer<T> | (() => z.infer<T>)
): z.ZodEffects<T, z.infer<T>, z.infer<T>>

/**
 * Gabungkan schema dengan limits (batas char + fallback)
 */
export function createRobustSchema<T extends z.ZodObject<any>>(
  baseSchema: T,
  limits: Array<{
    field: keyof z.infer<T>;
    maxChars?: number;
    maxItems?: number;
    fallback?: any;
  }>
): z.ZodObject<any>
```

---

### 2.3 System Prompt

| # | Checklist | Status |
|---|-----------|--------|
| 2.3.1 | System prompt **WAJIB** ada di file terpisah (di `lib/ai/prompts.ts` atau `lib/ai/*Prompts.ts`) | ☐ |
| 2.3.2 | System prompt **WAJIB** menyertakan batas karakter per-field | ☐ |
| 2.3.3 | System prompt **WAJIB** menyertakan larangan format markdown di dalam JSON value | ☐ |
| 2.3.4 | System prompt **WAJIB** menyertakan minimal **1 few-shot example** | ☐ |
| 2.3.5 | System prompt **WAJIB** menyertakan instruksi `Keluarkan HANYA JSON valid` | ☐ |
| 2.3.6 | Prompt injection defense **WAJIB** diimplementasikan | ☐ |

**Template System Prompt yang Benar:**

```typescript
// lib/ai/contohPrompts.ts

export const SYSTEM_PROMPT_CONTOH = `Kamu adalah asisten AI untuk [deskripsi peran].

ATURAN WAJIB:
1. KELUARKAN HANYA JSON VALID - tanpa markdown fence, tanpa teks pembuka/penutup
2. JANGAN GUNAKAN FORMAT MARKDOWN DI DALAM JSON VALUE:
   - ❌ Jangan pakai **bold**, *italic*, # heading
   - ❌ Jangan pakai bullet list ( - , * ) di dalam string
   - ❌ Jangan pakai \`code block\` di dalam string
   - ✅ Gunakan plain text biasa dengan punctuation standar Indonesia
3. BATASAN PANJANG PER-FIELD (WAJIB DIIKUTI):
   - nama: Maksimal 100 karakter
   - deskripsi: Maksimal 300 karakter
   - instruksi: Maksimal 500 karakter
   - catatan: Maksimal 200 karakter
4. JIKA TIDAK PASTI, GUNAKAN FALLBACK TEXT yang sesuai konteks
5. GAYA BAHASA: Formal Indonesia untuk administrasi sekolah

OUTPUT JSON SCHEMA:
{
  "nama": "string (maks 100 karakter)",
  "deskripsi": "string (maks 300 karakter)",
  "instruksi": "string (maks 500 karakter)"
}

CONTOH OUTPUT YANG BENAR:
{
  "nama": "Fotosintesis dan Respirasi",
  "deskripsi": "Ananda dapat menjelaskan perbedaan proses fotosintesis...",
  "instruksi": "Perhatikan diagram berikut. Jawab pertanyaan 1-3."
}

CATATAN: AI TIDAK SELALU PATUH BATASAN. SELALU LAKUKAN TRUNCATE DI LAYER VALIDASI.`;
```

---

### 2.4 Template Rendering (PDF/DOCX/XLSX/PPTX)

| # | Checklist | Status |
|---|-----------|--------|
| 2.4.1 | Template rendering **WAJIB** pakai `auto-height` untuk text boxes/areas | ☐ |
| 2.4.2 | Template rendering **WAJIB** pakai `word-wrap` untuk table cells | ☐ |
| 2.4.3 | Template rendering **WAJIB** punya fallback/truncate jika teks overflow | ☐ |
| 2.4.4 | Placeholder styling (font, spacing) **WAJIB** konsisten dengan konten AI | ☐ |
| 2.4.5 | Fixed height **DILARANG** untuk area yang menerima konten dinamis | ☐ |

**Template yang Benar:**

```typescript
// ✅ BENAR - Auto-height dan word-wrap

// PDF Template
doc.text(contentText, x, y, {
  width: cellWidth,
  height: undefined, // Auto-height
  wordBreak: true,  // Word-wrap
  ellipsis: true,   // Truncate dengan ellipsis jika overflow
});

// DOCX Template (HTML)
td {
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  min-height: 20px; // Auto-expand
}

// ❌ SALAH - Fixed height
td {
  height: 50px; // DILARANG untuk konten dinamis
  overflow: hidden; // Tidak ada graceful handling
}
```

---

### 2.5 Error Handling & Fallback

| # | Checklist | Status |
|---|-----------|--------|
| 2.5.1 | Jika AI gagal generate, **WAJIB** ada fallback text yang meaningful | ☐ |
| 2.5.2 | Error message ke user **TIDAK BOLEH** exposing detail AI internals | ☐ |
| 2.5.3 | Jika validasi gagal, **WAJIB** ada retry/re-prompt mechanism | ☐ |
| 2.5.4 | Logging error **WAJIB** untuk debugging (tanpa expose ke user) | ☐ |

---

## 3. Struktur File Wajib

Setiap fitur AI generation baru **WAJIB** punya struktur file如下:

```
lib/
├── schemas/
│   └── [nama-fitur].ts          # Zod schemas (input & output)
├── ai/
│   ├── [nama-fitur]Prompts.ts   # System prompts
│   └── validation-utils.ts       # Shared utilities (existing)
├── export/
│   └── [nama-fitur]-export.ts   # PDF/DOCX/PPTX templates
app/
└── api/
    └── [nama-fitur]/
        └── route.ts             # API route
```

**Contoh Struktur:**

```
lib/
├── schemas/
│   ├── silabus.ts               # ✅ Ada
│   ├── lkpd.ts                  # ✅ Ada
│   └── laporan-evaluasi-lkpd.ts  # ✅ Ada
├── ai/
│   ├── silabusPrompts.ts         # ✅ Ada
│   ├── bahanAjarPrompts.ts       # ✅ Ada
│   ├── prompts.ts                # ✅ Ada
│   └── validation-utils.ts       # ✅ Ada (shared)
│   └── generators.ts             # ✅ Ada
├── export/
│   └── silabus-export.ts         # ✅ Ada
app/
└── api/
    ├── silabus/
    │   └── generate/
    │       └── route.ts          # ✅ Ada
    ├── generate-lkpd/
    │   └── route.ts              # ✅ Ada
    └── generate-laporan-evaluasi-lkpd/
        └── route.ts              # ✅ Ada
```

---

## 4. Testing Checklist

Sebelum deployment, setiap fitur AI **WAJIB** diuji dengan:

### 4.1 Test Cases untuk Overflow Handling

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Nama sangat panjang | "Sistem Pernapasan pada Manusia dengan Diagram Aliran Oksigen dan Karbon Dioksida melalui Paru-Paru" | Text truncated menjadi ~100 karakter dengan "..." |
| Deskripsi sangat panjang | String 2000 karakter | Text truncated sesuai max schema |
| Array items berlebihan | Array 50 items | Array truncated sesuai max items |
| Special characters | `<script>`, `**bold**`, `# heading` | Stripped, treated as plain text |
| Empty/null dari AI | AI return empty string | Fallback text applied |

### 4.2 Test Cases untuk Document Rendering

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Long text in table cell | Text 500+ chars in 100px cell | Wrapped, cell expands |
| Long text in PDF box | Text overflows fixed box | Auto-resize or truncate with ellipsis |
| Long text in Excel cell | Text 1000+ chars | Word-wrap enabled |
| Special formatting in JSON | `**bold**`, `# Header` | Rendered as plain text |

---

## 5. Code Review Checklist

Untuk PR yang menambah/memodifikasi fitur AI generation, reviewer **WAJIB** memastikan:

- [ ] Output schema Zod ada dan lengkap
- [ ] Semua field string punya batas karakter
- [ ] Shared utilities digunakan (bukan validasi manual)
- [ ] System prompt ada di file terpisah
- [ ] System prompt punya few-shot example
- [ ] System prompt melarang markdown di dalam JSON
- [ ] Template rendering pakai auto-height/word-wrap
- [ ] Fallback value ada untuk field critical
- [ ] Error handling sudah diimplementasi
- [ ] Test cases untuk overflow sudah dibuat

---

## 6. Contoh Implementasi Lengkap

Lihat implementasi referensi di:

| Fitur | File | Pattern |
|-------|------|---------|
| Silabus/ATP | `lib/schemas/silabus.ts`, `lib/ai/silabusPrompts.ts`, `lib/export/silabus-export.ts` | Schema + Prompt + Render |
| LKPD | `lib/schemas/lkpd.ts`, `app/api/generate-lkpd/route.ts`, `lib/doc-compiler.ts` | Schema + Prompt + Render |
| Laporan Evaluasi LKPD | `lib/schemas/laporan-evaluasi-lkpd.ts`, `app/api/generate-laporan-evaluasi-lkpd/route.ts`, `lib/doc-compiler.ts` | Schema + Prompt + Render |

---

## 7. Capaian Pembelajaran (CP) — Structured Data

### 7.1 Sumber Data

CP kurikulum disimpan di tabel `capaian_pembelajaran` (migration `17_create_capaian_pembelajaran.sql`).

**Sumber regulasi:**

| Kode | Regulasi | Jalur | Jenjang |
|------|----------|-------|---------|
| `046/2025` | Kepka BSKAP 046/H/KR/2025 | `kemendikdasmen` | SD, SMP, SMA |
| `9941/2025` | Kep Dirjen Pendis 9941/2025 | `kneelmenag` | RA, MI, MTs, MA, MAPK |
| `020/2026` | Kepka BKPDM 020/2026 (override) | `kemendikdasmen` | SD–SMA (Agama) |

**Override logic:** Untuk mapel Agama Umum (Islam, Hindu, Buddha, Khonghucu), `020/2026` mengesampingkan `046/2025`. Query menggunakan `ORDER BY (versi = '020/2026') DESC` agar versi override diutamakan. Agama Kristen & Katolik dari `020/2026` belum tersedia karena tabel multi-kolom tidak bisa di-OCR dengan baik — perlu input manual.

### 7.2 Struktur Tabel

```sql
capaian_pembelajaran (
  sumber_regulasi, jalur, jenjang, tipe_pendidikan,
  mapel_kode, mapel_nama, fase, kelas_umum,
  elemen JSONB  -- Array<{ nama_elemen, capaian_pembelajaran }>
)
```

### 7.3 Retrieval API

Gunakan `lib/cp-retrieval.ts`:

```typescript
import { getCPCached, determineJalur, formatCPForPrompt } from '@/lib/cp-retrieval';

// 1. Tentukan jalur berdasarkan konteks
const jalur = determineJalur({ jenjang: 'SMA', paiMode: null, kurikulum: 'merdeka' });
// → 'kemendikdasmen'

// 2. Ambil CP dari DB
const cp = await getCPCached({ mapel: 'MATEMATIKA', jenjang: 'SMA', fase: 'E', jalur });
// → CPRecord | null

// 3. Format untuk prompt AI
const cpText = formatCPForPrompt(cp);
// → "[Sumber: Kepka BSKAP 046/H/KR/2025 | II | SMA Fase E | X-XI]\n**Bilangan**: ..."
```

### 7.4 Wiring di Route API

```typescript
// app/api/silabus/generate/route.ts
let resolvedCP = capaianPembelajaran; // dari input user
if (!resolvedCP) {
  const { determineJalur, getCPCached, formatCPForPrompt } = await import('@/lib/cp-retrieval');
  const jalur = determineJalur({ jenjang, paiMode: pai_mode, kurikulum });
  const cpRecord = await getCPCached({ mapel: resolvedMapel, jenjang, fase, jalur, ... });
  if (cpRecord) resolvedCP = formatCPForPrompt(cpRecord);
}
```

CP retrieval bersifat best-effort. Jika tabel belum ada atau query gagal, route tetap melanjutkan tanpa CP (fallback ke knowledge model).

---

## 8. Revisi History

| Versi | Tanggal | Perubahan |
|--------|---------|-----------|
| 1.0 | 14 Juli 2026 | Initial release |
| 1.1 | 7 Agustus 2026 | Tambah Section 7: CP structured data retrieval |
| 1.2 | 7 Agustus 2026 | Tambah migration 20: agama umum dari 020/2026 (Islam, Hindu, Buddha, Khonghucu); override logic via ORDER BY |

---

**Catatan:** Dokumen ini adalah living document. Jika ada kebutuhan baru yang tidak tercakup, buat issue/pull request untuk mendiskusikan update.
