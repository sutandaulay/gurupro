export interface PresensiRingkas {
  sakit: number;
  izin: number;
  alpa: number;
}

export interface SiswaStatusRow {
  id: string;
  nama_siswa: string;
  nisn: string | null;
  nis_lokal: string | null;
  nomor_absen: number | null;
  status: {
    sikapTerisi: boolean;
    catatanTerisi: boolean;
    presensi: PresensiRingkas;
  };
}

export interface RaportNilaiMapel {
  mapelId: string;
  namaMapel: string;
  guruNama: string | null;
  nilaiAkhir: number | null;
  kkm: number | null;
  deskripsiCapaian: string;
  dikonfirmasiGuru: boolean;
  deskripsiDibukaUntukReview: boolean;
}

export interface WaliKelasDashboardData {
  kelas: {
    id: string;
    nama_kelas: string;
    school_id: string;
    wali_kelas: string | null;
  };
  periode: string;
  siswa: SiswaStatusRow[];
  sikap: Array<{
    siswaId: string;
    varian: string;
    penilaianPerDimensi: Array<{ dimensi: string; predikat: string }>;
    deskripsiUmum: string;
    dinilaiOleh: string;
    createdAt: string;
  }>;
  catatan: Array<{
    siswaId: string;
    catatan: string;
    ditulisOleh: string;
    updatedAt: string;
  }>;
  raportStatus: Array<{
    siswaId: string;
    raportId: string;
    status: string;
    namaTemplate: string;
    jenisLaporan: string;
    updatedAt: string;
    modeNilaiAkademik: string;
    nilaiMapel: RaportNilaiMapel[];
  }>;
  statistik: {
    totalSiswa: number;
    sikapTerisi: number;
    catatanTerisi: number;
    totalPresensi: PresensiRingkas;
  };
}

export const SIKAP_VARIAN_LABEL: Record<string, string> = {
  profil_pelajar_pancasila: 'Profil Pelajar Pancasila',
  dimensi_profil_lulusan_madrasah: 'Dimensi Profil Lulusan Madrasah',
  profil_rahmatan_lil_alamin: 'Profil Pelajar Rahmatan Lil Alamin (P2RA)',
};

export const RAPORT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  dikirim_ke_wali_kelas: 'Dikirim ke Wali Kelas',
  dikonfirmasi: 'Dikonfirmasi',
  difinalisasi: 'Difinalisasi',
  siap_print: 'Siap Print',
};

export const RAPORT_JENIS_LABEL: Record<string, string> = {
  tengah_semester: 'Tengah Semester',
  akhir_semester: 'Akhir Semester',
  kokurikuler_p5: 'Kokurikuler P5',
  kokurikuler_p2ra: 'Kokurikuler P2RA',
};
