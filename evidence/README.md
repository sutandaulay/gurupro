# Evidence GuruPRO AI — Log Bukti Berjalan

Setiap temuan/percobaan dicatat DI SINI saat kejadian (bukan ditunda ke laporan akhir).
Format: `[2026-08-02 HH:MM] <skenario/fase> — <deskripsi>`

## Struktur
- `00-baseline.md` — baseline DB + response time (pembanding before/after)
- `01-...` — catatan per fase/skenario
- `fixes/` — diff kode per perbaikan (inline per skenario)
- `requests/` — sample request/response penting
- `errors/` — stack trace error

## Aturan Pencatatan
- Simpan: request/response penting, query count per request, stack trace, diff perbaikan.
- Bug dari 3 kategori sensitif (migrasi DB, billing Poin, RBAC/tenant inti) → tandai `[APPROVAL]` dan jangan difix dulu.
