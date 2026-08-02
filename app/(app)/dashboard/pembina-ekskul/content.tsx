'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react';
import PenilaianEkstrakurikulerForm from '@/app/components/PenilaianEkstrakurikulerForm';
import type { EkstrakurikulerResponse } from '@/lib/schemas/sikap-ekskul';

export default function PembinaEkskulDashboard() {
  const [ekskulList, setEkskulList] = useState<EkstrakurikulerResponse[]>([]);
  const [selectedEkskul, setSelectedEkskul] = useState<string>('');
  const [periode, setPeriode] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current tahun ajaran and semester
    const now = new Date();
    const year = now.getFullYear();
    const nextYear = year + 1;
    const semester = now.getMonth() >= 6 ? 'ganjil' : 'genap';
    setPeriode(`${year}/${nextYear}-${semester}`);

    // Fetch ekskul list for current user (pembina)
    apiFetch('/api/ekstrakurikuler/my-ekskul')
      .then((res) => res.json())
      .then((data) => {
        if (data.data && data.data.length > 0) {
          setEkskulList(data.data);
          setSelectedEkskul(data.data[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch ekskul:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Memuat...</p>
      </div>
    );
  }

  if (ekskulList.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Anda belum ditugaskan sebagai pembina ekstrakurikuler.</p>
      </div>
    );
  }

  const currentEkskul = ekskulList.find((e) => e.id === selectedEkskul);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dashboard Pembina Ekstrakurikuler</h1>

        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Ekstrakurikuler</label>
            <select
              value={selectedEkskul}
              onChange={(e) => setSelectedEkskul(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {ekskulList.map((ekskul) => (
                <option key={ekskul.id} value={ekskul.id}>
                  {ekskul.namaEkskul}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Periode</label>
            <input
              type="text"
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className="p-2 border rounded"
              placeholder="2025/2026-ganjil"
            />
          </div>
        </div>

        {selectedEkskul && periode && (
          <div className="mt-6">
            <PenilaianEkstrakurikulerForm
              ekstrakurikulerId={selectedEkskul}
              ekstrakurikuler={currentEkskul ? {
                id: currentEkskul.id,
                nama_ekskul: currentEkskul.namaEkskul,
                kelasId: currentEkskul.kelasId
              } : undefined}
              periode={periode}
              onSuccess={() => alert('Penilaian ekstrakurikuler disimpan!')}
            />
          </div>
        )}

        {currentEkskul && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Daftar Siswa {currentEkskul.namaEkskul}</h2>
            <DaftarNilaiEkskul ekstrakurikulerId={selectedEkskul} periode={periode} />
          </div>
        )}
      </div>
    </div>
  );
}

function DaftarNilaiEkskul({ ekstrakurikulerId, periode }: { ekstrakurikulerId: string; periode: string }) {
  const [nilaiList, setNilaiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/penilaian-ekskul?ekstrakurikulerId=${ekstrakurikulerId}&periode=${periode}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setNilaiList(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ekstrakurikulerId, periode]);

  if (loading) return <p>Memuat...</p>;
  if (nilaiList.length === 0) return <p className="text-gray-500">Belum ada penilaian.</p>;

  const predikatLabels: Record<string, string> = {
    sangat_baik: 'Sangat Baik',
    baik: 'Baik',
    cukup: 'Cukup',
    perlu_bimbingan: 'Perlu Bimbingan',
  };

  return (
    <table className="w-full border-collapse border">
      <thead>
        <tr className="bg-gray-100">
          <th className="border p-2 text-left">No</th>
          <th className="border p-2 text-left">Nama Siswa</th>
          <th className="border p-2 text-left">Predikat</th>
          <th className="border p-2 text-left">Deskripsi</th>
        </tr>
      </thead>
      <tbody>
        {nilaiList.map((nilai, idx) => (
          <tr key={nilai.id}>
            <td className="border p-2">{idx + 1}</td>
            <td className="border p-2">{nilai.siswaId}</td>
            <td className="border p-2">
              <span
                className={`px-2 py-1 rounded text-sm ${
                  nilai.predikat === 'sangat_baik'
                    ? 'bg-green-100 text-green-800'
                    : nilai.predikat === 'baik'
                    ? 'bg-blue-100 text-blue-800'
                    : nilai.predikat === 'cukup'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {predikatLabels[nilai.predikat]}
              </span>
            </td>
            <td className="border p-2">{nilai.deskripsi}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
