'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'
import { useTeacherStore } from '@/lib/stores'

interface IndikatorItem {
  id: string
  kode: string
  nama: string
  komponen: string
}

interface IndikatorRating {
  indikatorId: string
  rating: number
  catatan: string
  buktiObservasi: string
}

export default function BuatObservasiPage() {
  const router = useRouter()
  const { activeSchoolId } = useTeacherStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [tahunAjaranId, setTahunAjaranId] = useState('')
  const [skpList, setSkpList] = useState<any[]>([])
  const [indikatorList, setIndikatorList] = useState<IndikatorItem[]>([])

  const [formData, setFormData] = useState({
    skpId: '',
    tanggalObservasi: new Date().toISOString().split('T')[0],
    jenis: 'kelas',
    suasanaPembelajaran: '',
    catatanObserver: '',
    rekomendasi: '',
  })

  const [ratings, setRatings] = useState<Record<string, IndikatorRating>>({})

  useEffect(() => {
    const taId = localStorage.getItem('tahunAjaranId') || ''
    setTahunAjaranId(taId)
    fetchInitData(taId)
  }, [])

  const fetchInitData = async (taId: string) => {
    setLoading(true)
    try {
      const [skpRes, indRes] = await Promise.all([
        fetch(taId ? `/api/skp?tahun_ajaran_id=${taId}` : '/api/skp'),
        fetch('/api/indikator-kinerja'),
      ])

      if (skpRes.ok) {
        const data = await skpRes.json()
        setSkpList(data)
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, skpId: data[0].id }))
        }
      }

      if (indRes.ok) {
        const data = await indRes.json()
        setIndikatorList(data)
      }
    } catch (err) {
      console.error('Failed to fetch init data:', err)
    } finally {
      setLoading(false)
    }
  }

  const setRating = (indikatorId: string, field: keyof IndikatorRating, value: any) => {
    setRatings(prev => ({
      ...prev,
      [indikatorId]: {
        indikatorId,
        rating: prev[indikatorId]?.rating || 3,
        catatan: prev[indikatorId]?.catatan || '',
        buktiObservasi: prev[indikatorId]?.buktiObservasi || '',
        ...{ [field]: value },
      },
    }))
  }

  const handleSimpan = async () => {
    if (!formData.tanggalObservasi) {
      setError('Tanggal observasi wajib diisi')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/observasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skpId: formData.skpId || null,
          tahunAjaranId,
          tanggalObservasi: formData.tanggalObservasi,
          jenis: formData.jenis,
          suasanaPembelajaran: formData.suasanaPembelajaran,
          catatanObserver: formData.catatanObserver,
          rekomendasi: formData.rekomendasi,
          indikator: Object.values(ratings).filter(r => r.rating > 0),
          sekolahId: activeSchoolId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menyimpan observasi')
      }

      const data = await res.json()
      router.push(`/dashboard/laporan-kinerja/observasi/${data.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
        <span>←</span>
        <span>Kembali</span>
      </Button>

      <h1 className="text-2xl font-bold mb-2">👁️ Observasi Kinerja Baru</h1>
      <p className="text-muted-foreground mb-6">
        Input hasil observasi kelas sesuai indikator kinerja PKG 2026
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form Info */}
      <div className="bg-card border rounded-xl p-6 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Observasi</label>
            <input
              type="date"
              value={formData.tanggalObservasi}
              onChange={(e) => setFormData(prev => ({ ...prev, tanggalObservasi: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jenis Observasi</label>
            <select
              value={formData.jenis}
              onChange={(e) => setFormData(prev => ({ ...prev, jenis: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            >
              <option value="kelas">Observasi Kelas</option>
              <option value="wawancara">Wawancara</option>
              <option value="portfolio">Portfolio</option>
            </select>
          </div>
        </div>

        {skpList.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">SKP Terkait (opsional)</label>
            <select
              value={formData.skpId}
              onChange={(e) => setFormData(prev => ({ ...prev, skpId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            >
              <option value="">Tanpa SKP</option>
              {skpList.map((skp) => (
                <option key={skp.id} value={skp.id}>
                  {skp.tahun_ajaran_nama} — {skp.status}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Indikator Ratings */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">📊 Penilaian Indikator</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Beri rating 1–4 untuk setiap indikator yang terobservasi (1=Kurang, 2=Cukup, 3=Baik, 4=Sangat Baik)
        </p>

        <div className="space-y-4">
          {indikatorList.map((ind) => {
            const currentRating = ratings[ind.id]?.rating || 0
            return (
              <div key={ind.id} className={cn(
                'border rounded-lg p-4',
                currentRating > 0 ? 'border-violet-200 bg-violet-50/30' : 'border-gray-100'
              )}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{ind.kode}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{ind.komponen}</span>
                    </div>
                    <p className="text-sm mt-0.5">{ind.nama}</p>
                  </div>
                </div>

                {/* Rating buttons 1-4 */}
                <div className="flex items-center gap-2 mb-3">
                  {[1, 2, 3, 4].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRating(ind.id, 'rating', val)}
                      className={cn(
                        'w-10 h-10 rounded-lg text-sm font-medium transition-all',
                        currentRating === val
                          ? 'bg-violet-600 text-white ring-2 ring-violet-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {val}
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-2">
                    {['', 'Kurang', 'Cukup', 'Baik', 'Sangat Baik'][currentRating]}
                  </span>
                </div>

                {currentRating > 0 && (
                  <div className="space-y-2 ml-0">
                    <textarea
                      placeholder="Catatan untuk indikator ini..."
                      value={ratings[ind.id]?.catatan || ''}
                      onChange={(e) => setRating(ind.id, 'catatan', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-background resize-none"
                    />
                    <textarea
                      placeholder="Bukti yang terlihat saat observasi..."
                      value={ratings[ind.id]?.buktiObservasi || ''}
                      onChange={(e) => setRating(ind.id, 'buktiObservasi', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-background resize-none"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Catatan Observasi */}
      <div className="bg-card border rounded-xl p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Suasana Pembelajaran</label>
          <textarea
            value={formData.suasanaPembelajaran}
            onChange={(e) => setFormData(prev => ({ ...prev, suasanaPembelajaran: e.target.value }))}
            placeholder="Deskripsikan suasana pembelajaran yang terobservasi..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Catatan Observer</label>
          <textarea
            value={formData.catatanObserver}
            onChange={(e) => setFormData(prev => ({ ...prev, catatanObserver: e.target.value }))}
            placeholder="Catatan khusus dari observer..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rekomendasi Tindak Lanjut</label>
          <textarea
            value={formData.rekomendasi}
            onChange={(e) => setFormData(prev => ({ ...prev, rekomendasi: e.target.value }))}
            placeholder="Rekomendasi untuk perbaikan atau pengembangan..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => router.back()} className="flex-1">
          Batal
        </Button>
        <Button onClick={handleSimpan} disabled={saving} className="flex-1 gap-2">
          {saving ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <span>✓</span>
              <span>Simpan Observasi</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
