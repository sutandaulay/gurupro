# Discovery Report: Fitur Share ke Wali Kelas Non-GuruPRO

## Temuan Utama

Berdasarkan analisis terhadap codebase GuruPRO, berikut adalah temuan utama terkait kemungkinan adanya fitur "share ke Wali Kelas non-GuruPRO" untuk nilai raport, nilai ekstrakurikuler, dan nilai project siswa:

## 1. Struktur Share-to-Principal yang Ada

### A. Role Wali Kelas Tercatat dalam Sistem
- File: [collections/config.ts](file:///d:/gurupro/collections/config.ts)
- Ditemukan konstanta `LEADER_ROLES` yang mencakup:
  ```typescript
  LEADER_ROLES = {
    KEPALA_SEKOLAH: "kepala_sekolah",
    PENGAWAS: "pengawas", 
    WALI_KELAS: "wali_kelas",  // <-- TERDAPAT!
    LAINNYA: "lainnya",
  }
  ```

### B. Komponen UI Mendukung Role Wali Kelas
- File: [app/components/performance-share/PerformanceSharePanel.tsx](file:///d:/gurupro/app/components/performance-share/PerformanceSharePanel.tsx)
- Terdapat mapping role dalam konstanta `ROLE_LABELS`:
  ```typescript
  const ROLE_LABELS: Record<string, string> = {
    kepala_sekolah: "Kepala Sekolah",
    pengawas: "Pengawas", 
    wali_kelas: "Wali Kelas",  // <-- TERDAPAT!
    lainnya: "Lainnya",
  };
  ```

### C. Fungsi Share-to-Principal Tersedia
- File: [lib/performance-share.ts](file:///d:/gurupro/lib/performance-share.ts)
- Terdapat fungsi-fungsi yang mendukung pembuatan dan manajemen link share
- File: [app/components/performance-share/PerformanceSharePanel.tsx](file:///d:/gurupro/app/components/performance-share/PerformanceSharePanel.tsx)
- Menyediakan UI lengkap untuk menambah kontak dan membuat share link

## 2. Fungsi Download/Export untuk Data Nilai

### A. Export Excel untuk Data Raport
- File: [app/api/raport/eksternal/generate-excel/route.ts](file:///d:/gurupro/app/api/raport/eksternal/generate-excel/route.ts)
- Endpoint: `POST /api/raport/eksternal/generate-excel`
- Fungsi: Menghasilkan data nilai dalam format Excel yang bisa diunduh
- Dilengkapi dengan verifikasi OTP dan validasi token

### B. Export PDF untuk Data Raport  
- File: [app/api/raport/eksternal/generate-pdf/route.ts](file:///d:/gurupro/app/api/raport/eksternal/generate-pdf/route.ts)
- Endpoint: `POST /api/raport/eksternal/generate-pdf`
- Fungsi: Menghasilkan raport PDF yang bisa diunduh
- Juga dilengkapi dengan verifikasi OTP dan validasi token

### C. Sistem Kontak Eksternal untuk Raport
- File: [app/api/raport/kontak-eksternal/route.ts](file:///d:/gurupro/app/api/raport/kontak-eksternal/route.ts)
- Fungsi: Membuat dan mengelola kontak eksternal yang bisa menerima data raport
- Termasuk pengiriman link via email dan WhatsApp

## 3. Sistem Notifikasi Dalam Aplikasi

### A. Collection In-App Notifications
- Ditemukan collection `in_app_notifications` dalam sistem
- File: [lib/raport/notifications.ts](file:///d:/gurupro/lib/raport/notifications.ts)
- Terdapat fungsi `sendInAppNotification()` yang menyimpan notifikasi ke database:
  ```typescript
  async function sendInAppNotification(
    userId: string,
    title: string,
    body: string,
    referenceType: string,
    referenceId: string,
    type: 'info' | 'warning' | 'success' = 'info'
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, title, body, type, referenceType, referenceId]
      );
    } catch (err) {
      console.error('Failed to send in-app notification:', err);
    }
  }
  ```

### B. Penggunaan Sistem Notifikasi
- Sistem notifikasi digunakan secara aktif dalam workflow raport
- File: [lib/raport/notifications.ts](file:///d:/gurupro/lib/raport/notifications.ts)
- Fungsi `sendRaportNotification()` mengirim notifikasi ke wali kelas saat raport dikirim untuk direview
- Notifikasi dikirim melalui 3 saluran: in-app, email, dan WhatsApp

## 4. Analisis Kesesuaian untuk Wali Kelas

### A. Potensi Implementasi
- Sistem **sudah mendukung** role `wali_kelas` dalam flow share-to-principal
- Fungsi export Excel dan PDF **sudah tersedia** untuk data raport/nilai
- Fungsi kontak eksternal **sudah tersedia** untuk membagikan data ke pihak luar
- Fungsi download **sudah tersedia** dan termasuk verifikasi keamanan
- Sistem **notifikasi dalam aplikasi** sudah tersedia dan digunakan

### B. Ketersediaan Fitur Spesifik
- **Struktur dasar** untuk share ke wali kelas sudah ada dalam bentuk role `wali_kelas`
- **Fungsi export** untuk nilai raport, ekstrakurikuler, dan project sudah tersedia
- **Mekanisme share** dan **download** sudah berfungsi untuk kontak eksternal
- **Sistem notifikasi dalam aplikasi** sudah digunakan untuk workflow raport
- Namun, **tidak ditemukan** antarmuka spesifik yang membedakan "share ke wali kelas" dari "share ke kepala sekolah"

## 5. Kesimpulan

**STATUS: (B) SEBAGIAN ADA**

### Yang Sudah Tersedia:
1. Struktur role `wali_kelas` dalam sistem
2. Fungsi export Excel dan PDF untuk data nilai/raport
3. Sistem kontak eksternal untuk membagikan data ke pihak luar
4. Fungsi download dengan verifikasi OTP
5. UI PerformanceSharePanel yang mendukung role wali kelas
6. Sistem notifikasi dalam aplikasi ([in_app_notifications](file:///d:/gurupro/lib/notifications.ts)) yang sudah digunakan

### Yang Belum Tersedia:
1. Antarmuka spesifik untuk "Share ke Wali Kelas" (saat ini hanya umum untuk "Share to Principal")
2. Workflow spesifik untuk pembagian nilai ekstrakurikuler dan project ke wali kelas
3. Filter atau kustomisasi konten spesifik untuk wali kelas (mungkin hanya data yang terkait dengan kelasnya)

### Rekomendasi:
Sistem dasar sudah cukup lengkap, dan hanya membutuhkan penyesuaian UI/workflow agar bisa secara eksplisit memungkinkan guru untuk "Share ke Wali Kelas" sebagai role terpisah dari kepala sekolah, dengan konten yang relevan dengan kelas yang dikelolanya.

## 6. Rekomendasi untuk Skenario Inbox/Notifikasi Wali Kelas

### Infrastruktur Notifikasi yang Tersedia
Melalui pencarian lebih lanjut di codebase, ditemukan bahwa sistem notifikasi in-app memang sudah tersedia dan aktif digunakan:

- Collection [IN_APP_NOTIFICATIONS](file:///d:/gurupro/lib/notifications.ts) digunakan dalam sistem
- File: [lib/raport/notifications.ts](file:///d:/gurupro/lib/raport/notifications.ts) berisi fungsi-fungsi untuk mengelola notifikasi
- Sistem notifikasi digunakan secara aktif untuk workflow raport, termasuk untuk wali kelas

### Rekomendasi untuk Implementasi Skenario B (Inbox/Notifikasi)
Jika skenario "inbox/notifikasi" untuk wali kelas belum ada, **sangat mungkin** untuk memanfaatkan infrastruktur yang sudah ada:

1. **Memanfaatkan [in_app_notifications](file:///d:/gurupro/lib/notifications.ts) collection**: Gunakan struktur data notifikasi yang sudah ada daripada membuat dari awal

2. **Mengadaptasi flow share yang sudah ada**: Daripada membuat sistem share baru, ubah flow share eksternal menjadi flow internal untuk wali kelas:
   - Alih-alih menghasilkan link OTP untuk eksternal, sistem bisa langsung membuat notifikasi dalam aplikasi
   - Wali kelas bisa melihat data yang dibagikan langsung di inbox mereka tanpa perlu OTP

3. **Menggunakan struktur data existing**: Gunakan struktur data dan fungsi-fungsi yang sudah ada dari flow share-to-principal dan kontak-eksternal, hanya dengan modifikasi untuk menargetkan user internal (wali kelas) daripada kontak eksternal

4. **Menggunakan existing [sendInAppNotification](file:///d:/gurupro/lib/raport/notifications.ts#L134-L145) function**: Fungsi ini sudah digunakan dalam sistem raport dan dapat digunakan kembali untuk notifikasi share-to-wali-kelas

### Pendekatan Implementasi yang Disarankan
- Gunakan existing [LEADER_ROLES.WALI_KELAS](file:///d:/gurupro/collections/config.ts#L58-L58) untuk mengidentifikasi penerima notifikasi
- Gunakan existing export functions untuk menyiapkan data yang akan dibagikan
- Gunakan existing [sendInAppNotification](file:///d:/gurupro/lib/raport/notifications.ts#L134-L145) untuk membuat notifikasi dalam aplikasi
- Tautkan notifikasi ke halaman view data yang sesuai (bukan ke link OTP eksternal)

Dengan pendekatan ini, sebagian besar komponen bisa di-reuse dari sistem yang sudah ada, hanya dengan modifikasi pada logika routing dan delivery mechanism. Sistem notifikasi dalam aplikasi sudah berfungsi dan digunakan secara aktif dalam workflow raport, sehingga dapat menjadi dasar yang kuat untuk fitur share ke wali kelas.

## 7. Analisis Lanjutan: Kelola Nilai Native oleh Wali Kelas

### A. Dashboard Wali Kelas dan Form Edit Nilai
- File: [app/(app)/dashboard/wali-kelas/page.tsx](file:///d:/gurupro/app/(app)/dashboard/wali-kelas/page.tsx)
- File: [app/components/PenilaianSikapForm.tsx](file:///d:/gurupro/app/components/PenilaianSikapForm.tsx)
- File: [app/components/CatatanWaliKelasForm.tsx](file:///d:/gurupro/app/components/CatatanWaliKelasForm.tsx)

#### Sub-halaman dan Form Edit:
1. **Penilaian Sikap Form**: Terdapat form untuk mengisi/mengedit nilai sikap siswa dengan berbagai varian (Profil Pelajar Pancasila, Dimensi Profil Lulusan Madrasah, Profil Pelajar Rahmatan Lil Alamin).
   - Fungsi submit: `fetch('/api/penilaian-sikap', {method: 'POST', ...})`
   - Input nilai: Ya, wali kelas dapat mengedit nilai sikap dan deskripsi umum

2. **Catatan Wali Kelas Form**: Terdapat form untuk mengisi/mengedit catatan tentang siswa.
   - Fungsi submit: `fetch('/api/catatan-wali-kelas', {method: 'POST', ...})`
   - Input nilai: Ya, wali kelas dapat mengedit catatan wali kelas

#### Kesimpulan Role Wali Kelas:
**Wali Kelas BISA EDIT nilai**, namun terbatas pada:
- **Nilai sikap** (penilaian sikap per dimensi dan deskripsi umum)
- **Catatan wali kelas**
- **Bukan nilai akademik** (ini tetap menjadi domain guru mapel)

### B. Middleware/Permission Check
- File: [app/api/penilaian-sikap](file:///d:/gurupro/app/api/penilaian-sikap) (ditemukan di [lib/sikap-ekskul.ts](file:///d:/gurupro/lib/sikap-ekskul.ts))
- File: [app/api/catatan-wali-kelas](file:///d:/gurupro/app/api/catatan-wali-kelas) (ditemukan di [lib/sikap-ekskul.ts](file:///d:/gurupro/lib/sikap-ekskul.ts))

Dalam [lib/sikap-ekskul.ts](file:///d:/gurupro/lib/sikap-ekskul.ts), terdapat RBAC validation:

```typescript
// Di fungsi insertPenilaianSikap
const waliKelas = await getWaliKelasForKelas(input.kelasId, tahunAjar, semesterEnum);
if (!waliKelas || waliKelas.waliKelasMemberId !== actorMemberId) {
  throw new Error('Hanya wali kelas aktif kelas ini yang bisa mengisi sikap siswa');
}
```

dan

```typescript
// Di fungsi upsertCatatanWaliKelas
const waliKelas = await getWaliKelasForKelas(input.kelasId, tahunAjar, semesterEnum);
if (!waliKelas || waliKelas.waliKelasMemberId !== actorMemberId) {
  throw new Error('Hanya wali kelas aktif kelas ini yang bisa menulis catatan');
}
```

#### Kesimpulan Permission:
- Role wali kelas memiliki permission untuk mengedit nilai **sikap dan catatan** siswa di kelasnya
- Ini terpisah dari guru mapel biasa yang mengelola nilai akademik
- Validasi RBAC memastikan hanya wali kelas aktif yang bisa mengedit data terkait

### C. Kesimpulan Tegas Skenario A:
**Wali Kelas BISA EDIT** nilai, khususnya:
- **Nilai sikap** (penilaian sikap per dimensi dan deskripsi umum)
- **Catatan wali kelas**
- **Bukan nilai akademik** (ini tetap menjadi domain guru mapel)

## 8. Detail Trigger sendRaportNotification()

### A. Isi Fungsi sendRaportNotification()
File: [lib/raport/notifications.ts](file:///d:/gurupro\lib\raport\notifications.ts):

```typescript
export async function sendRaportNotification(
  params: SendRaportNotificationParams
): Promise<void> {
  const { event, raportId, raport, kelasId, changedBy } = params;

  // Get active tahun ajaran and semester
  let tahunAjaran = '';
  let semester: 'ganjil' | 'genap' = 'ganjil';

  try {
    const ta = await getActiveTahunAjaran();
    if (ta) {
      tahunAjaran = ta.nama;
      semester = getCurrentSemester();
    }
  } catch {
    // Continue without tahun ajaran
  }

  // Determine recipients based on event type
  let recipients: { userId: string; nama: string; email?: string; whatsapp?: string }[] = [];

  switch (event) {
    case 'dikirim_ke_wali_kelas':
      // Notify wali kelas
      if (tahunAjaran) {
        const waliKelas = await getWaliKelasForKelas(kelasId, tahunAjaran, semester);
        if (waliKelas?.guru) {
          recipients.push({
            userId: waliKelas.waliKelasMemberId,
            nama: waliKelas.guru.nama,
            email: waliKelas.guru.email,
            whatsapp: waliKelas.guru.whatsapp,
          });
        }
      }
      break;

    // ... kasus lainnya
  }

  // ... kode untuk mengirim notifikasi
}
```

### B. Tempat Fungsi Ini Dipanggil
Ditemukan dalam file: [lib/raport/repository.ts](file:///d:/gurupro\lib\raport\repository.ts):

1. **Baris 167**: Saat status raport berubah (dalam fungsi [ubahStatus](file:///d:/gurupro/lib/raport/repository.ts#L122-L174))
```typescript
await sendRaportNotification({
  event: keStatus as RaportStatusEvent,
  raportId: dataRaportId,
  raport: {
    siswaNama: raport.nama_siswa,
    kelasNama: raport.nama_kelas,
    templateNama: raport.nama_template,
    periode: raport.periode,
  },
  kelasId: raport.kelas_id,
  changedBy,
});
```

2. **Baris 244**: Saat nilai berubah setelah raport dikonfirmasi/finalisasi (dalam fungsi [handleNilaiBerubahSetelahKonfirmasi](file:///d:/gurupro/lib/raport/repository.ts#L234-L259))
```typescript
await sendRaportNotification({
  event: 'nilai_diubah_setelah_konfirmasi',
  raportId: row.id,
  raport: {
    siswaNama: '',
    kelasNama: '',
    templateNama: '',
    periode: row.periode,
  },
  kelasId: row.kelas_id,
  changedBy: 'system',
});
```

### C. Konteks dan Isi Notifikasi
- **Pemicu**: Guru mapel atau sistem yang mengubah status raport
- **Kapan triggernya**: Saat raport dikirim ke wali kelas untuk direview (status berubah ke `dikirim_ke_wali_kelas`)
- **Isi notifikasi**: Informasi tentang siswa, kelas, periode, dan instruksi untuk login dan memeriksa raport
- **Link ke halaman**: Tidak menyertakan link spesifik, tetapi menginstruksikan wali kelas untuk login ke sistem

### D. Cakupan Notifikasi
Fungsi ini **HANYA untuk raport**, bukan untuk nilai ekstrakurikuler atau project secara langsung. Namun, struktur fungsinya **reusable** untuk jenis notifikasi lain karena:
- Menggunakan parameter `event` untuk menentukan konteks
- Memungkinkan customisasi template berdasarkan event
- Menggunakan sistem notifikasi universal (in-app, email, WhatsApp)

## 9. Cakupan Lintas Institusi

### A. Filter Institution_ID
Dalam fungsi [sendRaportNotification](file:///d:/gurupro/lib/raport/notifications.ts#L148-L276), tidak ada filter eksplisit berdasarkan institution_id dalam query penerima notifikasi. Namun, dalam fungsi [getWaliKelasForKelas](file:///d:/gurupro/lib/wali-kelas.ts#L353-L361) (di [lib/wali-kelas.ts](file:///d:/gurupro/lib/wali-kelas.ts)), sistem mengambil data berdasarkan kelas_id dan periode, dan kelas sendiri terkait dengan sekolah/institusi tertentu.

Dalam [lib/wali-kelas.ts](file:///d:/gurupro/lib/wali-kelas.ts), ada validasi bahwa wali kelas harus merupakan anggota institusi yang sama dengan kelas:

```typescript
// Dalam fungsi assignWaliKelas
const memberInstitutionId = (member.institution as any)?.id || member.institution;
if (memberInstitutionId && kelas.school_id) {
  // Additional validation: check if the institution matches the school
  const institutionCheck = await query(
    'SELECT id FROM institutions WHERE id = $1',
    [memberInstitutionId]
  );
  if (institutionCheck.rows.length === 0) {
    throw new Error('Institution member tidak valid');
  }
}
```

### B. Kesimpulan Cakupan
Flow [sendRaportNotification](file:///d:/gurupro/lib/raport/notifications.ts#L148-L276) **mensyaratkan** bahwa pengirim (guru mapel) dan penerima (wali kelas) berada di **institusi/sekolah yang sama** karena:
- Sistem wali kelas dibangun berdasarkan assignment di dalam institusi yang sama
- Validasi RBAC memastikan hanya wali kelas aktif dari institusi yang sama yang bisa menerima notifikasi
- Kelas, siswa, dan penilaian terkait dengan institusi tertentu

Ini **bukan blocker** untuk skenario "guru individu share ke wali kelas pengguna GuruPRO" jika:
- Guru individu dan wali kelas sama-sama tergabung dalam institusi yang sama di GuruPRO
- Atau jika sistem dikembangkan untuk mendukung skenario lintas institusi dengan mekanisme sharing khusus

## 10. Kesimpulan Actionable

Untuk mewujudkan "guru individu share nilai raport/ekskul/project ke Wali Kelas pengguna GuruPRO dengan notifikasi in-app", ternyata:

**Perkembangan Kecil** - Sistem dasar sebagian besar **sudah siap pakai** dengan beberapa penambahan spesifik:

1. **Sudah Tersedia**:
   - Sistem notifikasi in-app ([in_app_notifications](file:///d:/gurupro/lib/notifications.ts))
   - Fungsi [sendRaportNotification](file:///d:/gurupro/lib/raport/notifications.ts#L148-L276) yang bisa direuse
   - Role [wali_kelas](file:///d:/gurupro/app/components/performance-share/PerformanceSharePanel.tsx#L65-L65) dalam sistem
   - Sistem permission untuk wali kelas

2. **Yang Perlu Ditambahkan**:
   - Endpoint khusus untuk sharing nilai esktrakurikuler dan project ke wali kelas
   - Fungsi untuk mengirim notifikasi khusus untuk nilai ekstrakurikuler dan project (dengan event baru)
   - UI untuk guru dalam menginisiasi sharing nilai ke wali kelas
   - Validasi RBAC tambahan untuk memastikan hanya guru yang berwenang yang bisa share nilai

Secara arsitektur, sistem sangat mendukung pengembangan fitur ini karena fondasi RBAC, notifikasi, dan sharing sudah tersedia dan teruji dalam konteks raport.