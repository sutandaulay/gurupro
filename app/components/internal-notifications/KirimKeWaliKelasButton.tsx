'use client';
import { apiFetch } from "@/lib/api-client";

import { useState } from 'react';
import { IconSend } from '@tabler/icons-react';

interface KirimKeWaliKelasButtonProps {
  siswaId: string;
  kelasId: string;
  contentType: 'raport' | 'ekskul' | 'project';
  dataId: string;
  periode: string;
  disabled?: boolean;
}

export default function KirimKeWaliKelasButton({
  siswaId,
  kelasId,
  contentType,
  dataId,
  periode,
  disabled = false
}: KirimKeWaliKelasButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKirim = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await apiFetch('/api/internal-notifications/nilai-to-wali-kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId,
          kelasId,
          contentType,
          dataId,
          periode
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim ke wali kelas');
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleKirim}
        disabled={loading || disabled}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          disabled 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : loading 
              ? 'bg-blue-100 text-blue-700' 
              : success 
                ? 'bg-green-100 text-green-700' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        <IconSend size={16} />
        {loading ? 'Mengirim...' : success ? 'Teririm!' : 'Kirim ke Wali Kelas'}
      </button>
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}