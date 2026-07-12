'use client';

import { useState, useEffect } from 'react';

interface Dimensi {
  dimensi: string;
  predikat: 'sangat_baik' | 'baik' | 'cukup' | 'perlu_bimbingan';
}

interface Siswa {
  id: string;
  nama_siswa: string;
  nomor_absen: number;
}

interface PenilaianSikapFormProps {
  kelasId: string;
  siswaId?: string;
  periode: string;
  existingData?: {
    varian: string;
    penilaianPerDimensi: Dimensi[];
    deskripsiUmum: string;
  };
  onSuccess?: () => void;
}

export default function PenilaianSikapForm({
  kelasId,
  siswaId,
  periode,
  existingData,
  onSuccess,
}: PenilaianSikapFormProps) {
  const [varian, setVarian] = useState<'profil_pelajar_pancasila' | 'dimensi_profil_lulusan_madrasah' | 'profil_rahmatan_lil_alamin'>(
    (existingData?.varian as any) || 'profil_pelajar_pancasila'
  );
  const [selectedSiswa, setSelectedSiswa] = useState<string>(siswaId || '');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [penilaianPerDimensi, setPenilaianPerDimensi] = useState<Dimensi[]>(
    existingData?.penilaianPerDimensi || []
  );
  const [deskripsiUmum, setDeskripsiUmum] = useState(existingData?.deskripsiUmum || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dimensiPancasila = [
    'beriman_bertakwa',
    'berkebinekaan_global',
    'bergotong_royong',
    'mandiri',
    'bernalar_kritis',
    'kreatif',
  ];

  const dimensiMadrasah = [
    'keimanan_ketakwaan',
    'kewargaan',
    'penalaran_kritis',
    'kreativitas',
    'kolaborasi',
    'kemandirian',
    'kesehatan',
    'komunikasi',
  ];

  const dimensiP2RA = [
    'berkeadaban',
    'keteladanan',
    'kewarganegaraan',
    'tawassuth',
    'tawazun',
    'itidal',
    'musawah',
    'syura',
    'tasamuh',
    'dinamis_inovatif',
  ];

  const predikatOptions = [
    { value: 'sangat_baik', label: 'Sangat Baik' },
    { value: 'baik', label: 'Baik' },
    { value: 'cukup', label: 'Cukup' },
    { value: 'perlu_bimbingan', label: 'Perlu Bimbingan' },
  ];

  const currentDimensi = varian === 'profil_pelajar_pancasila' ? dimensiPancasila : varian === 'profil_rahmatan_lil_alamin' ? dimensiP2RA : dimensiMadrasah;
  const dimensiLabels: Record<string, string> = {
    beriman_bertakwa: 'Beriman & Bertaqwa',
    berkebinekaan_global: 'Berkebinekaan Global',
    bergotong_royong: 'Bergotong Royong',
    mandiri: 'Mandiri',
    bernalar_kritis: 'Bernalar Kritis',
    kreatif: 'Kreatif',
    keimanan_ketakwaan: 'Keimanan & Ketakwaan',
    kewargaan: 'Kewargaan',
    penalaran_kritis: 'Penalaran Kritis',
    kreativitas: 'Kreativitas',
    kolaborasi: 'Kolaborasi',
    kemandirian: 'Kemandirian',
    kesehatan: 'Kesehatan',
    komunikasi: 'Komunikasi',
    berkeadaban: 'Berkeadaban (Ta\'addub)',
    keteladanan: 'Keteladanan (Qudwah)',
    kewarganegaraan: 'Kewarganegaraan (Muwathanah)',
    tawassuth: 'Tawassuth (Jalan Tengah)',
    tawazun: 'Tawazun (Berimbang)',
    itidal: 'I\'tidal (Lurus & Tegas)',
    musawah: 'Musawah (Kesetaraan)',
    syura: 'Syura (Musyawarah)',
    tasamuh: 'Tasamuh (Toleransi)',
    dinamis_inovatif: 'Dinamis & Inovatif',
  };

  useEffect(() => {
    if (kelasId) {
      fetch(`/api/students?class_id=${kelasId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setSiswaList(data.data);
          } else if (Array.isArray(data)) {
            // API returns array directly
            setSiswaList(data);
          }
        })
        .catch(console.error);
    }
  }, [kelasId]);

  useEffect(() => {
    let list: string[];
    if (varian === 'profil_pelajar_pancasila') {
      list = dimensiPancasila;
    } else if (varian === 'profil_rahmatan_lil_alamin') {
      list = dimensiP2RA;
    } else {
      list = dimensiMadrasah;
    }
    const newDimensi = list.map((d) => {
      const existing = penilaianPerDimensi.find((p) => p.dimensi === d);
      return existing || { dimensi: d, predikat: 'baik' as const };
    });
    setPenilaianPerDimensi(newDimensi);
  }, [varian]);

  const handlePredikatChange = (dimensi: string, predikat: string) => {
    setPenilaianPerDimensi((prev) =>
      prev.map((p) => (p.dimensi === dimensi ? { ...p, predikat: predikat as any } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!selectedSiswa) {
      setError('Pilih siswa terlebih dahulu');
      setLoading(false);
      return;
    }

    if (penilaianPerDimensi.length === 0) {
      setError('Pilih minimal satu dimensi penilaian');
      setLoading(false);
      return;
    }

    if (!deskripsiUmum.trim()) {
      setError('Deskripsi umum wajib diisi');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/penilaian-sikap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId: selectedSiswa,
          kelasId,
          periode,
          varian,
          penilaianPerDimensi,
          deskripsiUmum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan penilaian');
      }

      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-semibold">Penilaian Sikap</h3>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-50 text-green-700 rounded border border-green-200">
          Penilaian sikap berhasil disimpan!
        </div>
      )}

      {!siswaId && (
        <div>
          <label className="block text-sm font-medium mb-1">Pilih Siswa</label>
          <select
            value={selectedSiswa}
            onChange={(e) => setSelectedSiswa(e.target.value)}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">-- Pilih Siswa --</option>
            {siswaList.map((siswa) => (
              <option key={siswa.id} value={siswa.id}>
                {siswa.nomor_absen}. {siswa.nama_siswa}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Varian Penilaian</label>
        <select
          value={varian}
          onChange={(e) => setVarian(e.target.value as any)}
          className="w-full p-2 border rounded"
        >
          <option value="profil_pelajar_pancasila">Profil Pelajar Pancasila (Kurikulum Merdeka)</option>
          <option value="dimensi_profil_lulusan_madrasah">Dimensi Profil Lulusan Madrasah</option>
          <option value="profil_rahmatan_lil_alamin">Profil Pelajar Rahmatan Lil Alamin - P2RA (KBC)</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Penilaian per Dimensi</label>
        {penilaianPerDimensi.map((item) => (
          <div key={item.dimensi} className="flex items-center gap-4 p-2 bg-gray-50 rounded">
            <span className="flex-1 text-sm">{dimensiLabels[item.dimensi] || item.dimensi}</span>
            <select
              value={item.predikat}
              onChange={(e) => handlePredikatChange(item.dimensi, e.target.value)}
              className="p-1 border rounded text-sm"
            >
              {predikatOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Deskripsi Umum</label>
        <textarea
          value={deskripsiUmum}
          onChange={(e) => setDeskripsiUmum(e.target.value)}
          rows={4}
          className="w-full p-2 border rounded"
          placeholder="Tuliskan deskripsi umum tentang sikap siswa..."
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Menyimpan...' : 'Simpan Penilaian Sikap'}
      </button>
    </form>
  );
}
