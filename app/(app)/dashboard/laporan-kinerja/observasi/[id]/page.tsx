'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'

interface IndikatorRating {
  id: string
  indikator_id: string
  rating: number
  catatan: string | null
  bukti_observasi: string | null
  kode: string
  indikator_nama: string
  komponen: string
}

interface ObservasiData {
  id: string
  tanggal_observasi: string
  jenis: string
  status: string
  suasana_pembelajaran: string | null
  catatan_observer: string | null
  rekomendasi: string | null
  observer_nama: string | null
  indikator_ratings: IndikatorRating[]
}

export default function DetailObservasiPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [observasi, setObservasi] = useState<ObservasiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetchObservasi()
  }, [id])

  const fetchObservasi = async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/observasi/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data')
      setObservasi(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelesai = async () => {
    try {
      const res = await apiFetch(`/api/observasi/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (res.ok) {
        setObservasi(prev => prev ? { ...prev, status: 'completed' } : null)
        setEditing(false)
      }
    } catch (err) {
      console.error('Finalize failed:', err)
    }
  }

  const handleHapus = async () => {
    if (!confirm('Hapus observasi ini?')) return
    try {
      const res = await apiFetch(`/api/observasi/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard/laporan-kinerja/observasi')
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const ratingLabel = (val: number) => {
    const labels = ['', 'Kurang', 'Cukup', 'Baik', 'Sangat Baik']
    return labels[val] || ''
  }

  const ratingColor = (val: number) => {
    const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-green-500']
    return colors[val] || 'bg-gray-300'
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

  if (error || !observasi) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error || 'Observasi tidak ditemukan'}
        </div>
        <Button variant="ghost" onClick={() => router.back()}>Kembali</Button>
      </div>
    )
  }

  const avgRating = observasi.indikator_ratings?.length > 0
    ? (observasi.indikator_ratings.reduce((s, r) => s + r.rating, 0) / observasi.indikator_ratings.length)
    : 0

  const totalRated = observasi.indikator_ratings?.length || 0

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/laporan-kinerja/observasi')} className="mb-2 gap-2 -ml-2">
            <span>←</span>
            <span>Kembali</span>
          </Button>
          <h1 className="text-2xl font-bold">👁️ Detail Observasi</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>
              {new Date(observasi.tanggal_observasi).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </span>
            <span>•</span>
            <span>{observasi.jenis === 'kelas' ? 'Observasi Kelas' : observasi.jenis}</span>
            {observasi.observer_nama && (
              <>
                <span>•</span>
                <span>Observer: {observasi.observer_nama}</span>
              </>
            )}
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs',
              observasi.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            )}>
              {observasi.status === 'completed' ? 'Selesai' : 'Draft'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        {observasi.status !== 'completed' && (
          <Button onClick={handleSelesai} className="gap-2">
            <span>✓</span>
            <span>Selesaikan Observasi</span>
          </Button>
        )}
        <Button variant="destructive" onClick={handleHapus} className="gap-2">
          <span>🗑️</span>
          <span>Hapus</span>
        </Button>
      </div>

      {/* Ringkasan Rating */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-violet-700">{avgRating.toFixed(1)}</div>
            <div className="text-xs text-violet-500">Rata-rata</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-violet-700">{totalRated}</div>
            <div className="text-xs text-violet-500">Indikator dinilai</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-violet-700">{observasi.status === 'completed' ? '✓' : '...'}</div>
            <div className="text-xs text-violet-500">Status</div>
          </div>
        </div>
      </div>

      {/* Indikator Ratings */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">📊 Penilaian Indikator</h2>
        <div className="space-y-4">
          {observasi.indikator_ratings?.map((r) => (
            <div key={r.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.kode}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{r.komponen}</span>
                  </div>
                  <p className="text-sm mt-0.5">{r.indikator_nama}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold', ratingColor(r.rating))}>
                    {r.rating}
                  </div>
                  <span className="text-xs text-muted-foreground">{ratingLabel(r.rating)}</span>
                </div>
              </div>
              {r.catatan && (
                <div className="mt-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-2">
                  <span className="text-xs font-medium text-gray-500">Catatan:</span> {r.catatan}
                </div>
              )}
              {r.bukti_observasi && (
                <div className="mt-1 text-sm text-muted-foreground bg-muted/30 rounded-lg p-2">
                  <span className="text-xs font-medium text-gray-500">Bukti:</span> {r.bukti_observasi}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Catatan Observer */}
      {observasi.suasana_pembelajaran && (
        <div className="bg-card border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-2">🏫 Suasana Pembelajaran</h2>
          <p className="text-muted-foreground whitespace-pre-line">{observasi.suasana_pembelajaran}</p>
        </div>
      )}

      {observasi.catatan_observer && (
        <div className="bg-card border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-2">📝 Catatan Observer</h2>
          <p className="text-muted-foreground whitespace-pre-line">{observasi.catatan_observer}</p>
        </div>
      )}

      {observasi.rekomendasi && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-amber-800 mb-2">🎯 Rekomendasi Tindak Lanjut</h2>
          <p className="text-amber-700 whitespace-pre-line">{observasi.rekomendasi}</p>
        </div>
      )}
    </div>
  )
}
