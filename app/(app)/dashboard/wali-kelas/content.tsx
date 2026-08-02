'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PenilaianSikapForm from '@/app/components/PenilaianSikapForm';
import CatatanWaliKelasForm from '@/app/components/CatatanWaliKelasForm';

interface Kelas {
  id: string;
  nama_kelas: string;
}

interface TahunAjaran {
  id: string;
  nama: string;
  semester: string;
}

function WaliKelasDashboardContent() {
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [periode, setPeriode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sikap' | 'catatan'>('sikap');
  const searchParams = useSearchParams();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'catatan' || tabParam === 'laporan') {
      setActiveTab('catatan');
    } else {
      setActiveTab('sikap');
    }
  }, [searchParams]);

  useEffect(() => {
    // Get current tahun ajaran and semester
    const now = new Date();
    const year = now.getFullYear();
    const nextYear = year + 1;
    const semester = now.getMonth() >= 6 ? 'ganjil' : 'genap';
    setPeriode(`${year}/${nextYear}-${semester}`);

    // Fetch kelas list for current user (wali kelas)
    apiFetch('/api/wali-kelas/my-classes')
      .then((res) => res.json())
      .then((data) => {
        if (data.data && data.data.length > 0) {
          setKelasList(data.data);
          setSelectedKelas(data.data[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch kelas:', err);
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

  if (kelasList.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Anda belum ditugaskan sebagai wali kelas.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dashboard Wali Kelas</h1>

        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="p-2 border rounded"
            >
              {kelasList.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.nama_kelas}
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

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveTab('sikap')}
            className={`px-4 py-2 rounded ${
              activeTab === 'sikap'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Penilaian Sikap
          </button>
          <button
            onClick={() => setActiveTab('catatan')}
            className={`px-4 py-2 rounded ${
              activeTab === 'catatan'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Catatan Wali Kelas
          </button>
        </div>

        {selectedKelas && periode && (
          <div className="mt-6">
            {activeTab === 'sikap' ? (
              <PenilaianSikapForm
                kelasId={selectedKelas}
                periode={periode}
                onSuccess={() => alert('Penilaian sikap disimpan!')}
              />
            ) : (
              <CatatanWaliKelasForm
                kelasId={selectedKelas}
                periode={periode}
                onSuccess={() => alert('Catatan wali kelas disimpan!')}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WaliKelasDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p>Memuat...</p>
      </div>
    }>
      <WaliKelasDashboardContent />
    </Suspense>
  );
}
