'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react';

interface CatatanWaliKelasFormProps {
  kelasId: string;
  siswaId?: string;
  periode: string;
  existingCatatan?: string;
  onSuccess?: () => void;
}

interface Siswa {
  id: string;
  nama_siswa: string;
  nomor_absen: number;
}

export default function CatatanWaliKelasForm({
  kelasId,
  siswaId,
  periode,
  existingCatatan,
  onSuccess,
}: CatatanWaliKelasFormProps) {
  const [selectedSiswa, setSelectedSiswa] = useState<string>(siswaId || '');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [catatan, setCatatan] = useState(existingCatatan || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (kelasId) {
      apiFetch(`/api/students?class_id=${kelasId}`)
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

    if (!catatan.trim()) {
      setError('Catatan wajib diisi');
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/api/catatan-wali-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId: selectedSiswa,
          kelasId,
          periode,
          catatan: catatan.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan catatan');
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
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-semibold">Catatan Wali Kelas</h3>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-50 text-green-700 rounded border border-green-200">
          Catatan wali kelas berhasil disimpan!
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
        <label className="block text-sm font-medium mb-1">Catatan</label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={6}
          className="w-full p-2 border rounded"
          placeholder="Tuliskan catatan tentang perkembangan siswa..."
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Menyimpan...' : 'Simpan Catatan'}
      </button>
    </form>
  );
}
