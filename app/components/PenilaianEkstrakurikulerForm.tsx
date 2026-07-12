'use client';

import { useState, useEffect } from 'react';

interface Siswa {
  id: string;
  nama_siswa: string;
  nomor_absen: number;
}

interface Ekstrakurikuler {
  id: string;
  nama_ekskul: string;
  kelasId: string;
  kelas_nama?: string;
}

interface PenilaianEkstrakurikulerFormProps {
  ekstrakurikulerId: string;
  ekstrakurikuler?: Ekstrakurikuler;
  periode: string;
  pembinaMemberId?: string;
  onSuccess?: () => void;
}

export default function PenilaianEkstrakurikulerForm({
  ekstrakurikulerId,
  ekstrakurikuler,
  periode,
  onSuccess,
}: PenilaianEkstrakurikulerFormProps) {
  const [selectedSiswa, setSelectedSiswa] = useState<string>('');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [ekskul, setEkskul] = useState<Ekstrakurikuler | null>(ekstrakurikuler || null);
  const [predikat, setPredikat] = useState<'sangat_baik' | 'baik' | 'cukup' | 'perlu_bimbingan'>('baik');
  const [deskripsi, setDeskripsi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const predikatOptions = [
    { value: 'sangat_baik', label: 'Sangat Baik' },
    { value: 'baik', label: 'Baik' },
    { value: 'cukup', label: 'Cukup' },
    { value: 'perlu_bimbingan', label: 'Perlu Bimbingan' },
  ];

  useEffect(() => {
    // Get ekskul details if not passed as prop
    if (!ekskul && ekstrakurikulerId) {
      fetch(`/api/ekstrakurikuler`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data && data.data.length > 0) {
            const found = data.data.find((e: any) => e.id === ekstrakurikulerId);
            if (found) {
              setEkskul(found);
              // Get students in the same class
              fetch(`/api/students?class_id=${found.kelasId}`)
                .then((res) => res.json())
                .then((data) => {
                  if (data.data) {
                    setSiswaList(data.data);
                  } else if (Array.isArray(data)) {
                    setSiswaList(data);
                  }
                })
                .catch(console.error);
            }
          }
        })
        .catch(console.error);
    } else if (ekskul && ekskul.kelasId) {
      // Get students if ekskul is passed as prop
      fetch(`/api/students?class_id=${ekskul.kelasId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setSiswaList(data.data);
          } else if (Array.isArray(data)) {
            setSiswaList(data);
          }
        })
        .catch(console.error);
    }
  }, [ekstrakurikulerId, ekskul]);

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

    if (!deskripsi.trim()) {
      setError('Deskripsi wajib diisi');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/penilaian-ekskul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId: selectedSiswa,
          ekstrakurikulerId,
          periode,
          predikat,
          deskripsi: deskripsi.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan penilaian');
      }

      setSuccess(true);
      setSelectedSiswa('');
      setPredikat('baik');
      setDeskripsi('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-semibold">
        Penilaian Ekstrakurikuler
        {ekskul && <span className="ml-2 font-normal">- {ekskul.nama_ekskul}</span>}
      </h3>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-50 text-green-700 rounded border border-green-200">
          Penilaian ekstrakurikuler berhasil disimpan!
        </div>
      )}

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

      <div>
        <label className="block text-sm font-medium mb-1">Predikat</label>
        <select
          value={predikat}
          onChange={(e) => setPredikat(e.target.value as any)}
          className="w-full p-2 border rounded"
        >
          {predikatOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Deskripsi</label>
        <textarea
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          rows={4}
          className="w-full p-2 border rounded"
          placeholder="Tuliskan deskripsi tentang partisipasi dan pencapaian siswa..."
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? 'Menyimpan...' : 'Simpan Penilaian'}
      </button>
    </form>
  );
}
